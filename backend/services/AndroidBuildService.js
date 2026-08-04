import { executeViaSsm } from "./executeCommandService.js";
import { updateSession } from "./sessionRepository.js";
import { getContainerPort, getContainerHost } from "../lib/labTools.js";

const executeContainerHttp = async (session, content, path = "/workspace/.vlab_tmp/run_cmd.sh") => {
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
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: data.success !== false,
        output: data.output || "",
        error: data.error || null,
      };
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
   * Phase 4, 5, 6, 7 & 13: Asynchronous background build with performance optimizations.
   */
  static async startBuild(session) {
    const wrapperScript = `#!/bin/sh
cd /tmp/workspace/workspace
mkdir -p .vlab_tmp

echo "RUNNING" > build.status
rm -f build.log latest_apk.path

# Phase 13: Store Gradle cache in local container storage (/tmp/gradle_cache) to eliminate EFS I/O bottlenecks
export GRADLE_USER_HOME="/tmp/gradle_cache"
mkdir -p /tmp/gradle_cache

# Enable multi-core parallel execution and task output caching
export GRADLE_OPTS="-Dorg.gradle.daemon=true -Dorg.gradle.parallel=true -Dorg.gradle.caching=true -Dorg.gradle.configureondemand=true -Dorg.gradle.jvmargs='-Xmx2048m -XX:+UseParallelGC -XX:MaxMetaspaceSize=512m'"
export JAVA_OPTS="-Xmx2048m"

if [ -f "gradle.properties" ]; then
  grep -q "org.gradle.parallel" gradle.properties || echo "org.gradle.parallel=true" >> gradle.properties
  grep -q "org.gradle.caching" gradle.properties || echo "org.gradle.caching=true" >> gradle.properties
  grep -q "org.gradle.daemon" gradle.properties || echo "org.gradle.daemon=true" >> gradle.properties
else
  cat << 'EOF' > gradle.properties
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx2048m -XX:+UseParallelGC -XX:MaxMetaspaceSize=512m
EOF
fi

# Clean line endings and prepare build scripts
sed -i 's/\r$//' gradlew build.sh 2>/dev/null || true
sed -i 's|cd /workspace|cd "$(dirname "$0")"|g' build.sh 2>/dev/null || true
chmod +x gradlew build.sh 2>/dev/null || true

# Execute student's build.sh
./build.sh > build.log 2>&1
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
  echo "SUCCESS" > build.status
  # Phase 7 & 10: Persist generated APK path to latest_apk.path
  python3 -c "import glob, os; apks=glob.glob('/tmp/workspace/workspace/**/*.apk', recursive=True); apks.sort(key=os.path.getmtime); open('/tmp/workspace/workspace/latest_apk.path', 'w').write(apks[-1]) if apks else None" 2>/dev/null || true
else
  echo "FAILED" > build.status
fi
`.replace(/\r/g, "");

    const httpRes1 = await executeContainerHttp(session, wrapperScript, "/workspace/.vlab_tmp/run_android_build.sh");
    if (httpRes1) {
      await executeContainerHttp(session, `setsid /bin/sh /tmp/workspace/workspace/.vlab_tmp/run_android_build.sh < /dev/null > /dev/null 2>&1 &`, "/workspace/.vlab_tmp/exec_build.sh");
    } else {
      // Fallback to SSM
      const chownCmd = '\nif [ -f "/app/lab_server.py" ]; then chown -R $(stat -c \'%U:%G\' /app/lab_server.py) /tmp/workspace; else chown -R labuser:labuser /tmp/workspace || true; fi\n';
      await executeViaSsm(session, {
        action: "run",
        path: "/workspace/.vlab_tmp/run_android_build.sh",
        language: "shell",
        labType: "linux",
        content: wrapperScript + chownCmd,
      });
      await executeViaSsm(session, {
        action: "run",
        path: "/workspace/.vlab_tmp/exec_build.sh",
        language: "shell",
        labType: "linux",
        content: (`#!/bin/sh\nsetsid /bin/sh /tmp/workspace/workspace/.vlab_tmp/run_android_build.sh < /dev/null > /dev/null 2>&1 &` + chownCmd).replace(/\r/g, ""),
      });
    }

    // Set status to RUNNING in DB
    await updateSession(session.sessionId, {
      build: {
        status: "RUNNING",
        startedAt: new Date().toISOString(),
        apkPath: null,
      },
    });
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
