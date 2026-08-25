import pty from 'node-pty';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { getSession } from './services/sessionRepository.js';
import { ENV } from './config/env.js';

const LOCAL_SHELL = os.platform() === 'win32' ? 'cmd.exe' : 'bash';
const activePtys = new Map(); // Store PTYs strictly by socket.id

// OSC window-title sequences (\x1b]0;…\x07) and orphaned "0;…" when ESC is dropped (SSM/ECS).
const stripOscTitleSequences = (data) => {
  return data
    .replace(/\x1b\]0;[^\x07]*\x07/g, "")
    .replace(/^0;[^\r\n]*\r/g, "");
};

// Strips early SSM noise from early stream chunks.
const stripStartupNoise = (data) => {
  let cleaned = data.toString()
    .replace(/The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/g, '')
    .replace(/Starting session with SessionId:\s*[a-zA-Z0-9-]+[\r\n]*/g, '');

  const promptIndex = cleaned.indexOf('bash-');
  if (promptIndex !== -1) {
    cleaned = cleaned.substring(promptIndex);
  }
  return cleaned;
};

export const setupTerminal = (io) => {
  io.on("connection", async (socket) => {
    console.log("[Terminal] Client connected:", socket.id);

    const sessionId = socket.handshake.query.sessionId;
    if (!sessionId) {
      socket.emit("terminal-output", "\r\n\x1b[31m[ERROR: Session ID required]\x1b[0m\r\n");
      socket.disconnect();
      return;
    }

    let session = null;
    try {
      session = await getSession(sessionId);
    } catch (err) {
      console.error('[Session Error]', err.message);
    }

    const cluster = process.env.ECS_CLUSTER || session?.cluster;

    console.log('[Terminal Debug - Session Setup]', {
      event: 'START_LAB_TERMINAL_CONNECTION',
      sessionId: sessionId,
      socketId: socket.id,
      sessionExists: !!session,
      taskArn: session?.taskArn || null,
      taskId: session?.taskArn ? session.taskArn.split('/').pop() : null,
      cluster: cluster,
      labId: session?.labId || null,
      containerName: ENV.ecsContainerName || 'lab-runtime'
    });

    let ptyProcess = null;
    let isContainer = false;
    let hasSentContainerOutput = false;

    // Create a unique temporary home directory for this socket connection.
    // This isolates the AWS CLI and Session Manager Plugin configs (telemetry, logs, locks)
    // to prevent TargetNotConnectedException/lock clashing when running multiple concurrent terminals.
    const userTempDir = path.join(os.tmpdir(), `aws_ssm_term_${socket.id}`);
    try {
      fs.mkdirSync(userTempDir, { recursive: true });
    } catch (e) {
      console.warn('[Terminal] Failed to create temp isolation directory:', e.message);
    }

    if (session && session.taskArn && cluster) {
      try {
        const taskId = session.taskArn.split('/').pop();
        const containerName = ENV.ecsContainerName || 'lab-runtime';
        const interactiveShell = ENV.ecsInteractiveShell;

        console.log(`Connecting terminal socket ${socket.id} to ECS container...`);

        let awsExePath = ENV.awsCliPath || 'aws';
        if (awsExePath === 'aws' && os.platform() === 'win32') {
          if (fs.existsSync('C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe')) {
            awsExePath = 'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe';
          }
        }

        let actualContainerName = containerName;
        let agentReady = false;

        try {
          const { describeTask } = await import('./services/ecsService.js'); 
          const initialTaskDetails = await describeTask(session.taskArn);
          if (initialTaskDetails) {
            const container = initialTaskDetails.containers?.find(c => c.name === 'lab-runtime') || initialTaskDetails.containers?.[0];
            if (container && container.name) {
              actualContainerName = container.name;
            }
            const execAgent = container?.managedAgents?.find(a => a.name === 'ExecuteCommandAgent');
            if (execAgent?.lastStatus === 'RUNNING' && initialTaskDetails.lastStatus === 'RUNNING') {
              agentReady = true;
            }
          }

          if (!agentReady) {
            socket.emit('terminal-status', { status: 'polling', message: 'Checking ECS Container Readiness...' });
            console.log('[Terminal] Polling ExecuteCommandAgent readiness...');

            for (let i = 0; i < 90; i++) {
              const taskDetails = await describeTask(session.taskArn);
              if (taskDetails) {
                const container = taskDetails.containers?.find(c => c.name === 'lab-runtime') || taskDetails.containers?.[0];
                if (container && container.name) {
                  actualContainerName = container.name;
                }
                const execAgent = container?.managedAgents?.find(a => a.name === 'ExecuteCommandAgent');
                if (execAgent?.lastStatus === 'RUNNING' && taskDetails.lastStatus === 'RUNNING') {
                  agentReady = true;
                  break;
                }
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
              socket.emit('terminal-status', {
                status: 'polling',
                message: `Waiting for container shell (${i + 1}/90)...`,
              });
            }
          }
        } catch (err) {
          console.warn('[Readiness Check Error]', err.message);
        }

        if (!agentReady) {
          console.warn('[ExecuteCommandAgent NOT READY] Timeout reached.');
          socket.emit('terminal-status', {
            status: 'timeout',
            message: 'Could not open a shell in the container. If BUILD/RUN is active, wait for it to finish and retry.',
          });
          return;
        } else {
          console.log('[ExecuteCommandAgent READY] Container:', actualContainerName);
          socket.emit('terminal-status', { status: 'ready', message: 'Terminal Connected' });
        }

        const region = process.env.AWS_REGION || "ap-south-1";
        const ptyArgs = [
          "ecs",
          "execute-command",
          "--cluster",
          cluster,
          "--task",
          taskId,
          "--container",
          actualContainerName,
          "--interactive",
          "--command",
          interactiveShell,
          "--region",
          region,
        ];

        const { getSsmEnv } = await import('./services/awsExecuteCommand.js');
        const ptyEnv = {
          ...process.env,
          ...getSsmEnv(),
          HOME: userTempDir,
          USERPROFILE: userTempDir,
          HOMEPATH: userTempDir,
          TERM: "xterm-256color",
          AWS_PAGER: "",
        };

        if (os.platform() === 'win32') {
          const pathDelimiter = ';';
          const pathKey = Object.keys(ptyEnv).find(k => k.toUpperCase() === 'PATH') || 'PATH';
          const additions = [];
          
          if (ENV.awsPtyPathAdditions) {
            additions.push(...ENV.awsPtyPathAdditions.split(';').map(p => p.trim()).filter(Boolean));
          } else {
            additions.push(
              'C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin',
              'C:\\Program Files\\Amazon\\AWSCLIV2'
            );
            const userHome = os.homedir();
            const pythonDir = path.join(userHome, 'AppData', 'Local', 'Python');
            if (fs.existsSync(pythonDir)) {
              try {
                const folders = fs.readdirSync(pythonDir);
                for (const folder of folders) {
                  additions.push(path.join(pythonDir, folder, 'Scripts'));
                }
              } catch (e) {}
            }
          }
          const pathString = additions.join(pathDelimiter);
          ptyEnv[pathKey] = `${pathString}${pathDelimiter}${ptyEnv[pathKey] || ''}`;
        }

        console.log("========== AWS EXECUTE COMMAND ==========");
        console.log("AWS CLI :", awsExePath);
        console.log("Cluster :", cluster);
        console.log("Command :", ptyArgs.join(" "));
        console.log("=========================================");

        ptyProcess = pty.spawn(awsExePath, ptyArgs, {
          name: "xterm-color",
          cols: 120,
          rows: 30,
          cwd: process.cwd(),
          useConpty: process.env.USE_CONPTY !== 'false',
          env: ptyEnv,
        });

        activePtys.set(socket.id, ptyProcess);
        isContainer = true;
        console.log(`[SUCCESS] ECS terminal connected for socket ${socket.id}`);

      } catch (err) {
        console.error('[ECS TERMINAL FAILED]', err.message);
        socket.emit('terminal-output', `\r\n\x1b[31m[ECS TERMINAL FAILED: ${err.message}]\x1b[0m\r\n`);
        return;
      }
    }

    // =====================================
    // LOCAL FALLBACK
    // =====================================
    if (!ptyProcess) {
      console.log('[LOCAL FALLBACK TERMINAL]');
      try {
        const localWorkspaceRoot = path.resolve(process.cwd(), '..');
        ptyProcess = pty.spawn(LOCAL_SHELL, [], {
          name: 'xterm-color',
          cols: 120,
          rows: 30,
          cwd: localWorkspaceRoot,
          useConpty: process.env.USE_CONPTY !== 'false',
          env: {
            ...process.env,
            TERM: 'xterm-256color',
          },
        });
        activePtys.set(socket.id, ptyProcess);
      } catch (err) {
        console.error('[LOCAL TERMINAL FAILED]', err.message);
        socket.emit('terminal-output', `\r\n\x1b[31m[Failed to launch local terminal: ${err.message}]\x1b[0m\r\n`);
        return;
      }
    }

    // =====================================
    // TERMINAL EVENT LISTENERS
    // =====================================
    ptyProcess.onData((data) => {
      if (isContainer) {
        if (!hasSentContainerOutput) {
          data = stripStartupNoise(data);
        } else {
          data = stripOscTitleSequences(data)
            .replace(/The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/g, '')
            .replace(/Starting session with SessionId:\s*[a-zA-Z0-9-]+[\r\n]*/g, '');
        }
        if (!data) return;
        hasSentContainerOutput = true;
      }
      socket.emit('terminal-output', data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log('PTY EXIT CODE:', exitCode);
      socket.emit('terminal-output', `\r\n[Terminal exited with code ${exitCode}]\r\n`);
      activePtys.delete(socket.id);
    });

    ptyProcess.on('error', (err) => {
      console.error('[PTY ERROR]', err);
      socket.emit('terminal-output', `\r\n\x1b[31m${err.message}\x1b[0m\r\n`);
    });

    // =====================================
    // SOCKET LISTENERS
    // =====================================
    socket.on('terminal-input', (data) => {
      if (ptyProcess) {
        try {
          ptyProcess.write(data);
        } catch (err) {
          console.error('[PTY WRITE ERROR]', err.message);
        }
      }
    });

    socket.on('terminal-run-file', ({ path: filePath, content, language }) => {
      if (ptyProcess) {
        try {
          const b64 = Buffer.from(content).toString('base64');
          let syncCmd;
          if (isContainer) {
            syncCmd = `echo "${b64}" | base64 -d > "${filePath}"`;
          } else {
            const localPath = path.join(path.resolve(process.cwd(), '..'), 'workspace', filePath.replace('/workspace/', '').replace(/^\/+/, ''));
            try { fs.writeFileSync(localPath, content); } catch (e) { }
            syncCmd = `echo "Local file synced"`;
          }

          let runCmd = '';
          if (language === 'python') runCmd = `python3 "${filePath}"`;
          else if (language === 'java') runCmd = `javac "${filePath}" && java Main`;
          else if (language === 'javascript') runCmd = `node "${filePath}"`;
          else runCmd = `echo "Language ${language} not supported for direct run"`;

          ptyProcess.write(`\nclear || cls\n${syncCmd} > /dev/null 2>&1\n${runCmd}\n`);
        } catch (err) {
          console.error('[PTY RUN FILE ERROR]', err.message);
        }
      }
    });

    socket.on('terminal-resize', ({ cols, rows }) => {
      if (ptyProcess) {
        try {
          ptyProcess.resize(cols, rows);
        } catch (err) {
          console.warn('Resize failed:', err.message);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Terminal disconnected:', socket.id);
      setTimeout(() => {
        try {
          if (ptyProcess && !socket.connected) {
            console.log('[KILLING PTY AFTER DISCONNECT]', socket.id);
            ptyProcess.kill();
            activePtys.delete(socket.id);
          }
          // Clean up the temp directory after session close
          if (fs.existsSync(userTempDir)) {
            fs.rmSync(userTempDir, { recursive: true, force: true });
          }
        } catch (err) {
          console.warn('PTY clean up failed:', err.message);
        }
      }, 5000);
    });

    // Signal ready for frontend tab
    if (isContainer) {
      socket.emit('terminal-status', { status: 'ready', message: 'Terminal Connected' });
    } else {
      socket.emit('terminal-status', { status: 'ready', message: 'Local Terminal Connected' });
    }
  });
};
