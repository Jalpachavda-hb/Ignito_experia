import { executeViaSsm } from "./executeCommandService.js";
import { updateSession } from "./sessionRepository.js";
import { getContainerPort, getContainerHost } from "../lib/labTools.js";
import { saveToContainer } from "./containerClient.js";

const executeContainerHttp = async (session, content, path = "/workspace/.vlab_tmp/run_cmd.sh", timeoutMs = 30000) => {
  try {
    const host = getContainerHost(session);
    const port = (await getContainerPort(session.labId)) || session.containerPort || 8080;
    const baseUrl = `http://${host}:${port}`;

    const headers = {
      "Content-Type": "application/json",
    };
    if (session.sessionToken) {
      headers["X-Session-Token"] = session.sessionToken;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          path,
          content,
          language: "shell",
          labType: "android",
          sessionId: session.sessionId,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: data.success !== false,
          output: data.output || "",
          error: data.error || null,
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    console.warn("[AndroidBuildService] HTTP execution failed, falling back to SSM:", err.message, err.cause?.message || "");
  }
  return null;
};

export class AndroidBuildService {
  /**
   * Validates if the workspace is an Android project with required files.
   * Phase 3: Checks gradlew, build.sh, app/, settings.gradle.
   */
  static async validateWorkspace(session) {
    const ensureTmpCmd = `#!/bin/sh
mkdir -p /tmp/workspace/workspace/.vlab_tmp
if [ -f "/app/lab_server.py" ]; then
  chown -R $(stat -c '%U:%G' /app/lab_server.py) /tmp/workspace/workspace/.vlab_tmp
else
  chown -R labuser:labuser /tmp/workspace/workspace/.vlab_tmp || true
fi
`;
    try {
      await executeViaSsm(session, {
        action: "run",
        path: "/workspace/.vlab_tmp/ensure_tmp_dir.sh",
        language: "shell",
        labType: "linux",
        content: ensureTmpCmd,
      });
    } catch (_) {
      // ignore
    }

    const checkCmd = `if [ -f "/tmp/workspace/workspace/gradlew" ] && [ -f "/tmp/workspace/workspace/build.sh" ] && [ -d "/tmp/workspace/workspace/app" ] && [ -f "/tmp/workspace/workspace/settings.gradle" ]; then echo "OK"; else echo "MISSING"; fi`;
    const httpRes = await executeContainerHttp(session, checkCmd, "/workspace/.vlab_tmp/check_workspace.sh");
    if (httpRes) {
      return (httpRes.output || "").trim() === "OK";
    }
    const res = await executeViaSsm(session, {
      action: "run",
      path: "/workspace/.vlab_tmp/check_workspace.sh",
      language: "shell",
      labType: "linux",
      content: `#!/bin/sh\n${checkCmd}\n`,
    });
    return (res.output || "").trim() === "OK";
  }

  /**
   * Starts the background Gradle build inside the container using the student's build.sh.
   * Writes the long-running wrapper via /save, then only executes a short background launcher.
   * Uses flock so concurrent BUILD clicks cannot start overlapping Gradle processes.
   */
  static async startBuild(session) {
    // String.raw so Python regex backslashes are preserved when embedded in the shell wrapper
    const manifestFixPy = String.raw`from pathlib import Path
import re
p = Path("app/src/main/AndroidManifest.xml")
text = p.read_text(encoding="utf-8", errors="ignore")
original = text
text = re.sub(r'\s+package\s*=\s*"[^"]*"', "", text, count=1)

def fix_activity(match):
    block = match.group(0)
    if re.search(r'android:exported\s*=', block, re.I):
        return block
    if not re.search(r'<intent-filter\b', block, re.I):
        return block
    return re.sub(r'(<activity\b)([^>]*)(>)', r'\1\2 android:exported="true"\3', block, count=1, flags=re.I)

text = re.sub(r'<activity\b[\s\S]*?</activity>', fix_activity, text, flags=re.I)
if text != original:
    p.write_text(text, encoding="utf-8")
    print("Sanitized AndroidManifest.xml (removed package= / added android:exported where needed)")
`;

    const wrapperScript = `#!/bin/sh
cd /tmp/workspace/workspace
mkdir -p .vlab_tmp

# Atomic lock (works on EFS/NFS where flock is unreliable)
LOCKDIR=".vlab_tmp/build.lock.dir"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  age=$(( $(date +%s) - $(stat -c %Y "$LOCKDIR" 2>/dev/null || echo 0) ))
  if [ "$age" -gt 1800 ]; then
    echo "Stealing stale build lock (age \${age}s)..." >> build.log
    rm -rf "$LOCKDIR"
    if ! mkdir "$LOCKDIR" 2>/dev/null; then
      echo "Another Android build is already running; ignoring duplicate start." >> build.log
      exit 0
    fi
  else
    echo "Another Android build is already running; ignoring duplicate start." >> build.log
    exit 0
  fi
fi
echo "$$" > "$LOCKDIR/pid"
trap 'rm -rf "$LOCKDIR"' EXIT INT TERM

echo "RUNNING" > build.status
{
  echo "Starting Android build..."
  echo "First build in a new session downloads Gradle/deps and can take a few minutes."
  echo "Subsequent builds reuse /tmp/gradle_cache and are much faster."
  echo ""
} > build.log
rm -f latest_apk.path

# Keep Gradle cache on local disk (not EFS) to avoid I/O bottlenecks
export GRADLE_USER_HOME="/tmp/gradle_cache"
mkdir -p /tmp/gradle_cache

# Avoid single-use daemons: do not fight gradle.properties with GRADLE_OPTS jvmargs
unset JAVA_TOOL_OPTIONS
unset GRADLE_OPTS
export JAVA_OPTS="-Xmx2048m"

if [ -f "gradle.properties" ]; then
  grep -q "org.gradle.parallel" gradle.properties || echo "org.gradle.parallel=true" >> gradle.properties
  grep -q "org.gradle.caching" gradle.properties || echo "org.gradle.caching=true" >> gradle.properties
  grep -q "org.gradle.daemon" gradle.properties || echo "org.gradle.daemon=true" >> gradle.properties
  grep -q "org.gradle.jvmargs" gradle.properties || echo "org.gradle.jvmargs=-Xmx2048m -XX:+UseParallelGC -XX:MaxMetaspaceSize=512m" >> gradle.properties
else
  cat << 'EOF' > gradle.properties
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.jvmargs=-Xmx2048m -XX:+UseParallelGC -XX:MaxMetaspaceSize=512m
EOF
fi

# Clean line endings and prepare build scripts
sed -i 's/\r$//' gradlew build.sh 2>/dev/null || true
sed -i 's|cd /workspace|cd "$(dirname "$0")"|g' build.sh 2>/dev/null || true
chmod +x gradlew build.sh 2>/dev/null || true

# Sanitize AndroidManifest for AGP 8+ / Android 12+
if [ -f "app/src/main/AndroidManifest.xml" ]; then
  python3 - <<'PY' >> build.log 2>&1
${manifestFixPy}
PY
fi

# Repair empty/corrupt res XML + ensure manifest @style themes exist
python3 - <<'PY' >> build.log 2>&1
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET

RES = Path("app/src/main/res")
MANIFEST = Path("app/src/main/AndroidManifest.xml")
VECTOR = """<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#3DDC84" android:pathData="M0,0h108v108h-108z"/>
</vector>
"""
RESOURCES = """<?xml version="1.0" encoding="utf-8"?>
<resources>
</resources>
"""
LAYOUT = """<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
"""
MENU = """<?xml version="1.0" encoding="utf-8"?>
<menu xmlns:android="http://schemas.android.com/apk/res/android">
</menu>
"""
COLOR = """<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:color="#FF000000" />
</selector>
"""

def needs_repair(path: Path) -> bool:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore").strip()
    except Exception:
        return True
    if not text:
        return True
    try:
        ET.fromstring(text)
        return False
    except ET.ParseError:
        return True

def stub_for(path: Path) -> str:
    parent = path.parent.name.lower()
    if parent.startswith("values"):
        return RESOURCES
    if parent.startswith("layout"):
        return LAYOUT
    if parent.startswith("menu"):
        return MENU
    if parent.startswith("color"):
        return COLOR
    if parent.startswith("drawable") or parent.startswith("mipmap"):
        return VECTOR
    return RESOURCES

changed = False
repaired = []
if RES.is_dir():
    for f in RES.rglob("*.xml"):
        if needs_repair(f):
            f.write_text(stub_for(f), encoding="utf-8")
            repaired.append(str(f))
            changed = True

if repaired:
    print("Repaired empty/invalid resource XML:")
    for r in repaired:
        print(" -", r)

# Ensure every @style/Name referenced in the manifest exists in themes.xml
needed = set()
if MANIFEST.exists():
    mtext = MANIFEST.read_text(encoding="utf-8", errors="ignore")
    needed = set(re.findall(r"@style/([A-Za-z0-9._]+)", mtext))

defined = set()
if RES.is_dir():
    for f in RES.rglob("*.xml"):
        if not f.parent.name.lower().startswith("values"):
            continue
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        defined.update(re.findall(r'<style\\s+[^>]*name="([^"]+)"', text))
        defined.update(re.findall(r"<style\\s+[^>]*name='([^']+)'", text))

missing = sorted(needed - defined)
if missing:
    themes = RES / "values" / "themes.xml"
    themes.parent.mkdir(parents=True, exist_ok=True)
    styles = "\\n".join(
        f'    <style name="{n}" parent="Theme.AppCompat.Light.NoActionBar" />'
        for n in missing
    )
    if themes.exists():
        body = themes.read_text(encoding="utf-8", errors="ignore")
        if not body.strip():
            body = '<?xml version="1.0" encoding="utf-8"?>\\n<resources>\\n</resources>\\n'
    else:
        body = '<?xml version="1.0" encoding="utf-8"?>\\n<resources>\\n</resources>\\n'
    if "</resources>" in body:
        body = body.replace("</resources>", styles + "\\n</resources>", 1)
    else:
        body = '<?xml version="1.0" encoding="utf-8"?>\\n<resources>\\n' + styles + "\\n</resources>\\n"
    themes.write_text(body, encoding="utf-8")
    print("Added missing theme styles to themes.xml:")
    for n in missing:
        print(" -", n)
    changed = True

if changed:
    build_dir = Path("app/build")
    if build_dir.exists():
        shutil.rmtree(build_dir, ignore_errors=True)
        print("Cleared app/build so repaired resources are recompiled")
PY

# Skip clean so incremental builds stay fast (clean forces full rebuild every click)
if [ -f "build.sh" ] && grep -qE '\\bclean\\b' build.sh; then
  echo "Optimizing: running assembleDebug without clean for faster builds..." >> build.log
  ./gradlew :app:assembleDebug --build-cache --parallel >> build.log 2>&1
elif [ -f "build.sh" ]; then
  ./build.sh >> build.log 2>&1
else
  ./gradlew :app:assembleDebug --build-cache --parallel >> build.log 2>&1
fi
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
  echo "SUCCESS" > build.status
  python3 -c "import glob, os; apks=glob.glob('/tmp/workspace/workspace/**/*.apk', recursive=True); apks.sort(key=os.path.getmtime); open('/tmp/workspace/workspace/latest_apk.path', 'w').write(apks[-1]) if apks else None" 2>/dev/null || true
  echo "" >> build.log
  echo "BUILD SUCCESSFUL" >> build.log
else
  echo "FAILED" > build.status
  echo "" >> build.log
  echo "BUILD FAILED (exit code $BUILD_EXIT_CODE)" >> build.log
fi
`.replace(/\r/g, "");

    const launcherScript = `#!/bin/sh
# Launch only — do not wait for Gradle to finish
setsid /bin/sh /tmp/workspace/workspace/.vlab_tmp/run_android_build.sh < /dev/null > /dev/null 2>&1 &
echo "BUILD_STARTED"
`.replace(/\r/g, "");

    // Claim RUNNING in DB before launching so concurrent API calls are rejected
    await updateSession(session.sessionId, {
      build: {
        status: "RUNNING",
        startedAt: new Date().toISOString(),
        apkPath: null,
      },
    });

    // 1) Write the long-running wrapper WITHOUT executing it
    try {
      await saveToContainer(session, {
        path: "/workspace/.vlab_tmp/run_android_build.sh",
        content: wrapperScript,
      });
    } catch (err) {
      console.warn("[AndroidBuildService] saveToContainer failed, using SSM write:", err.message);
      await executeViaSsm(session, {
        action: "run",
        path: "/workspace/.vlab_tmp/write_android_build.sh",
        language: "shell",
        labType: "linux",
        content: `#!/bin/sh
mkdir -p /tmp/workspace/workspace/.vlab_tmp
cat > /tmp/workspace/workspace/.vlab_tmp/run_android_build.sh << 'VLAB_EOF'
${wrapperScript}
VLAB_EOF
chmod +x /tmp/workspace/workspace/.vlab_tmp/run_android_build.sh
`,
      });
    }

    // 2) Execute only the short background launcher (must return quickly)
    const httpRes = await executeContainerHttp(
      session,
      launcherScript,
      "/workspace/.vlab_tmp/exec_build.sh",
      20000
    );
    if (!httpRes) {
      const chownCmd = '\nif [ -f "/app/lab_server.py" ]; then chown -R $(stat -c \'%U:%G\' /app/lab_server.py) /tmp/workspace; else chown -R labuser:labuser /tmp/workspace || true; fi\n';
      await executeViaSsm(session, {
        action: "run",
        path: "/workspace/.vlab_tmp/exec_build.sh",
        language: "shell",
        labType: "linux",
        content: (launcherScript + chownCmd).replace(/\r/g, ""),
      });
    }
  }

  /**
   * Reads the generated APK path instantly from latest_apk.path, or falls back to filesystem search.
   * Phase 10: Fast APK path retrieval without scanning filesystem every click.
   */
  static async locateLatestApk(session) {
    const checkCmd = `if [ -f "/tmp/workspace/workspace/latest_apk.path" ]; then cat /tmp/workspace/workspace/latest_apk.path; else python3 -c "import glob, os; apks=glob.glob('/tmp/workspace/workspace/**/*.apk', recursive=True); apks.sort(key=os.path.getmtime); print(apks[-1]) if apks else print('')"; fi`;
    const httpRes = await executeContainerHttp(session, checkCmd, "/workspace/.vlab_tmp/find_apk.sh");
    if (httpRes) {
      return (httpRes.output || "").trim();
    }
    const res = await executeViaSsm(session, {
      action: "run",
      path: "/workspace/.vlab_tmp/find_apk.sh",
      language: "shell",
      labType: "linux",
      content: `#!/bin/sh\n${checkCmd}\n`,
    });
    return (res.output || "").trim();
  }

  /**
   * Reads a chunk of the build log starting at the given byte offset.
   * Returns { logs: string, offset: number }
   */
  static async readLogChunk(session, offset = 0) {
    const pythonLogger = `import os
path = "/tmp/workspace/workspace/build.log"
size = 0
content = ""
if os.path.exists(path):
    size = os.path.getsize(path)
    if size > ${offset}:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(${offset})
            content = f.read()
print(content)
print("###SIZE:" + str(size) + "###")
`;
    const httpRes = await executeContainerHttp(session, `cat << 'EOF' > /tmp/read_log_chunk.py\n${pythonLogger}\nEOF\npython3 /tmp/read_log_chunk.py\n`, "/workspace/.vlab_tmp/read_log_chunk.sh");
    let output = "";
    if (httpRes) {
      output = httpRes.output || "";
    } else {
      const res = await executeViaSsm(session, {
        action: "run",
        path: "/workspace/.vlab_tmp/read_log_chunk.sh",
        language: "shell",
        labType: "linux",
        content: `#!/bin/sh\ncat << 'EOF' > /tmp/read_log_chunk.py\n${pythonLogger}\nEOF\npython3 /tmp/read_log_chunk.py\n`,
      });
      output = res.output || "";
    }

    const match = output.match(/###SIZE:(\d+)###/);
    let size = offset;
    let cleanLogs = output;

    if (match) {
      size = parseInt(match[1], 10);
      cleanLogs = output.replace(/###SIZE:\d+###[\r\n]*/g, "").trim();
    }

    return {
      logs: cleanLogs,
      offset: size,
    };
  }

  /**
   * Reads status file build.status from the container.
   */
  static async readBuildStatusFile(session) {
    const cmd = `if [ -f "/tmp/workspace/workspace/build.status" ]; then cat /tmp/workspace/workspace/build.status; else echo "IDLE"; fi`;
    const httpRes = await executeContainerHttp(session, cmd, "/workspace/.vlab_tmp/read_status.sh");
    if (httpRes) {
      return (httpRes.output || "").trim();
    }
    const res = await executeViaSsm(session, {
      action: "run",
      path: "/workspace/.vlab_tmp/read_status.sh",
      language: "shell",
      labType: "linux",
      content: `#!/bin/sh\nif [ -f "/tmp/workspace/workspace/build.status" ]; then\n  cat /tmp/workspace/workspace/build.status\nelse\n  echo "IDLE"\nfi\n`,
    });
    return (res.output || "").trim();
  }

  /**
   * Combined method to read both build status and log chunk from the container in a single command execution.
   */
  static async getBuildStatusAndLogs(session, offset = 0) {
    const pythonScript = `import os, json
status_path = "/tmp/workspace/workspace/build.status"
log_path = "/tmp/workspace/workspace/build.log"

status = "IDLE"
if os.path.exists(status_path):
    with open(status_path, "r") as f:
        status = f.read().strip()

size = 0
logs = ""
if os.path.exists(log_path):
    size = os.path.getsize(log_path)
    if size > ${offset}:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(${offset})
            logs = f.read()

print(json.dumps({
    "status": status,
    "offset": size,
    "logs": logs
}))
`;

    let output = "";
    const httpRes = await executeContainerHttp(session, `cat << 'EOF' > /tmp/get_status_logs.py\n${pythonScript}\nEOF\npython3 /tmp/get_status_logs.py\n`, "/workspace/.vlab_tmp/get_status_logs.sh");
    if (httpRes) {
      output = httpRes.output || "";
    } else {
      const res = await executeViaSsm(session, {
        action: "run",
        path: "/workspace/.vlab_tmp/get_status_logs.sh",
        language: "shell",
        labType: "linux",
        content: `#!/bin/sh\ncat << 'EOF' > /tmp/get_status_logs.py\n${pythonScript}\nEOF\npython3 /tmp/get_status_logs.py\n`,
      });
      output = res.output || "";
    }

    try {
      const cleanOutput = output.substring(output.indexOf("{"), output.lastIndexOf("}") + 1);
      const parsed = JSON.parse(cleanOutput.trim());
      return {
        status: parsed.status || "IDLE",
        offset: parsed.offset || offset,
        logs: parsed.logs || "",
      };
    } catch (e) {
      console.warn("[AndroidBuildService] Failed to parse status and logs JSON:", e.message, output);
      return {
        status: "RUNNING",
        offset: offset,
        logs: "",
      };
    }
  }
}
