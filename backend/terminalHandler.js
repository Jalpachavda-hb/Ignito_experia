import pty from 'node-pty';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { getSession } from './services/sessionRepository.js';

const LOCAL_SHELL = os.platform() === 'win32' ? 'cmd.exe' : 'bash';
const activePtys = new Map(); // Store PTYs strictly by socket.id

// OSC window-title sequences (\x1b]0;…\x07) and orphaned "0;…" when ESC is dropped (SSM/ECS).
const OSC_TITLE_SEQUENCE = /\x1b\](?:\d+;)?[^\x07\x1b]*(?:\x07|\x1b\\)/g;
const ORPHAN_TITLE_PREFIX = /^0;[^\x07\r\n]{0,200}?(?=[A-Za-z0-9_"'])/;

const stripOscTitleSequences = (data) => data.replace(OSC_TITLE_SEQUENCE, '');

const stripOrphanWindowTitle = (data) => data.replace(ORPHAN_TITLE_PREFIX, '');

const stripStartupNoise = (data) => {
  return stripOrphanWindowTitle(stripOscTitleSequences(data))
    .replace(/The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/g, '')
    .replace(/Starting session with SessionId:\s*[a-zA-Z0-9-]+[\r\n]*/g, '')
    .replace(/^(?:\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])|[\s\r\n])+/g, '');
};

export const setupTerminal = (io) => {
  io.on('connection', async (socket) => {
    console.log('Terminal Connected:', socket.id);

    // =====================================
    // GET SESSION
    // =====================================
    const sessionId = socket.handshake.query.sessionId;
    let session = null;

    try {
      session = await getSession(sessionId);
    } catch (err) {
      console.error('[Session Error]', err.message);
    }

    const cluster = process.env.ECS_CLUSTER || session?.cluster;

    // 1. Detailed logging for debugging
    console.log('[Terminal Debug - Detailed Flow Trace]', {
      event: 'START_LAB_TERMINAL_CONNECTION',
      sessionId: sessionId,
      sessionExists: !!session,
      taskArn: session?.taskArn || null,
      taskId: session?.taskArn ? session.taskArn.split('/').pop() : null,
      cluster: cluster,
      labId: session?.labId || null,
      containerName: 'lab-runtime', // Currently hardcoded
      fullSessionObject: session
    });

    let ptyProcess = null;
    let isContainer = false;
    let hasSentContainerOutput = false;

    // =====================================
    // TRY ECS TERMINAL
    // =====================================
    if (session && session.taskArn && cluster) {
      try {
        const taskId = session.taskArn.split('/').pop();

        const containerName = 'lab-runtime';
        const interactiveShell = 'sh -c "mkdir -p /tmp/workspace/workspace && (if [ -z \\"\\$(ls -A /tmp/workspace/workspace 2>/dev/null)\\\" ] && [ -d /workspace ]; then cp -rn /workspace/* /tmp/workspace/workspace/ 2>/dev/null || true; fi) && cd /tmp/workspace/workspace || cd /workspace; [ -x /bin/bash ] && exec bash || exec sh"';

        console.log('Connecting terminal to ECS container via /bin/sh...');

        // =====================================
        // AWS CLI PATH
        // =====================================
        let awsExePath = process.env.AWS_CLI_PATH || 'aws';
        if (!process.env.AWS_CLI_PATH && os.platform() === 'win32') {
          if (fs.existsSync('C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe')) {
            awsExePath = 'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe';
          } else {
            awsExePath = 'aws.exe';
          }
        }

        // =====================================
        // EXECUTE-COMMAND READINESS CHECK
        // =====================================
        let actualContainerName = containerName;
        let agentReady = false;

        socket.emit('terminal-status', { status: 'polling', message: 'Checking ECS Container Readiness...' });
        console.log('[Terminal] Polling ExecuteCommandAgent readiness...');

        try {
          const { describeTask } = await import('./services/ecsService.js'); 

          // Poll for up to 180 seconds (90 iterations * 2s)
          for (let i = 0; i < 90; i++) {
            const taskDetails = await describeTask(session.taskArn);

            if (taskDetails) {
              const container = taskDetails.containers?.find(c => c.name === 'lab-runtime') || taskDetails.containers?.[0];
              if (container && container.name) {
                actualContainerName = container.name;
              }

              const execAgent = container?.managedAgents?.find(a => a.name === 'ExecuteCommandAgent');
              console.log({
                taskStatus: taskDetails.lastStatus,
                containerStatus: container?.lastStatus,
                execAgent
              });
              // ECS tasks may be RUNNING but ExecuteCommandAgent takes extra time
              if (execAgent?.lastStatus === 'RUNNING' && taskDetails.lastStatus === 'RUNNING') {
                agentReady = true;
                break;
              }
            }

            // Wait 2 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (err) {
          console.warn('[Readiness Check Error]', err.message);
        }

        if (!agentReady) {
          console.warn('[ExecuteCommandAgent NOT READY] Timeout reached.');
          socket.emit('terminal-status', { status: 'timeout', message: 'Lab is taking longer than expected' });
          return; // Stop execution, don't spawn pty
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

        const ptyEnv = {
          ...process.env,
          TERM: "xterm-256color",
          AWS_PAGER: "",
        };

        if (os.platform() === 'win32') {
          const pathDelimiter = ';';
          const pathKey = Object.keys(ptyEnv).find(k => k.toUpperCase() === 'PATH') || 'PATH';
          const additions = [
            'C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin',
            'C:\\Program Files\\Amazon\\AWSCLIV2'
          ];
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
          const pathString = additions.join(pathDelimiter);
          ptyEnv[pathKey] = `${pathString}${pathDelimiter}${ptyEnv[pathKey] || ''}`;
        }

        console.log("========== AWS EXECUTE COMMAND ==========");
        console.log("AWS CLI :", awsExePath);
        console.log("Cluster :", cluster);
        console.log("Task ID :", taskId);
        console.log("Container :", actualContainerName);
        console.log("Region :", region);
        console.log("Command :", ptyArgs.join(" "));
        console.log("=========================================");

        ptyProcess = pty.spawn(awsExePath, ptyArgs, {
          name: "xterm-color",
          cols: 120,
          rows: 30,
          cwd: process.cwd(),
          useConpty: false,
          env: ptyEnv,
        });

        activePtys.set(socket.id, ptyProcess);

        let hasSentContainerOutput = false;
        ptyProcess.onData((data) => {
          if (!hasSentContainerOutput && isContainer) {
            data = stripStartupNoise(data);
            if (!data) return;
            hasSentContainerOutput = true;
          }

          socket.emit("terminal-output", data);
        });

        ptyProcess.onExit(({ exitCode }) => {
          console.log("[PTY EXIT]", exitCode);

          if (exitCode !== 0) {
            socket.emit(
              "terminal-output",
              `\r\n\x1b[31mTerminal exited with code ${exitCode}\x1b[0m\r\n`
            );
          }
        });

        ptyProcess.on("error", (err) => {
          console.error("[PTY ERROR]", err);

          socket.emit(
            "terminal-output",
            `\r\n\x1b[31m${err.message}\x1b[0m\r\n`
          );
        });

        isContainer = true;
        console.log("[SUCCESS] ECS terminal connected");

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
          useConpty: false,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
          },
        });

        activePtys.set(socket.id, ptyProcess);
      } catch (err) {
        console.error('[LOCAL TERMINAL FAILED]', err.message);
        socket.emit('terminal-output', `\r\n\x1b[31m[Failed to launch local terminal: ${err.message}]\x1b[0m\r\n`);
        return; // Stop here if even the local fallback fails
      }
    }

    // =====================================
    // CONNECTION BANNER
    // =====================================
    if (isContainer) {
      socket.emit('terminal-status', { status: 'ready', message: 'Terminal Connected' });
    } else {
      socket.emit('terminal-status', { status: 'ready', message: 'Local Terminal Connected' });
    }

    // =====================================
    // TERMINAL EVENT LISTENERS
    // =====================================
    if (ptyProcess) {
      ptyProcess.onData((data) => {
        if (isContainer) {
          if (!hasSentContainerOutput) {
            data = stripStartupNoise(data);
          } else {
            data = stripOscTitleSequences(data)
              .replace(/The Session Manager plugin was installed successfully\.\s*Use the AWS CLI to start a session\.[\r\n]*/g, '')
              .replace(/Starting session with SessionId:\s*[a-zA-Z0-9-]+[\r\n]*/g, '');
          }

          // Avoid sending empty chunks if they were completely replaced
          if (!data) {
            return;
          }
          hasSentContainerOutput = true;
        }

        socket.emit('terminal-output', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        console.log('PTY EXIT CODE:', exitCode);
        socket.emit('terminal-output', `\r\n[Terminal exited with code ${exitCode}]\r\n`);
        ptyProcess = null; // Prevent memory leak / double kill
      });
    }

    // =====================================
    // TERMINAL INPUT
    // =====================================
    socket.on('terminal-input', (data) => {
      console.log('[INPUT RAW]', JSON.stringify(data));
      if (ptyProcess) {
        try {
          ptyProcess.write(data);
        } catch (err) {
          console.error('[PTY WRITE ERROR]', err.message);
        }
      }
    });

    // =====================================
    // TERMINAL RUN FILE
    // =====================================
    socket.on('terminal-run-file', ({ path, content, language }) => {
      if (ptyProcess) {
        try {
          const b64 = Buffer.from(content).toString('base64');
          let syncCmd;
          if (isContainer) {
            syncCmd = `echo "${b64}" | base64 -d > "${path}"`;
          } else {
            // local machine fallback
            const fs = require('fs');
            const nodePath = require('path');
            const localPath = nodePath.join(process.cwd(), path.replace('/workspace/', ''));
            try { fs.writeFileSync(localPath, content); } catch (e) { }
            syncCmd = `echo "Local file synced"`;
          }

          let runCmd = '';
          if (language === 'python') runCmd = `python3 "${path}"`;
          else if (language === 'java') runCmd = `javac "${path}" && java Main`;
          else if (language === 'javascript') runCmd = `node "${path}"`;
          else runCmd = `echo "Language ${language} not supported for direct run"`;

          // Adding a small sleep to ensure the prompt is ready if needed, 
          // but sending the clear and commands directly should work.
          ptyProcess.write(`\nclear || cls\n${syncCmd} > /dev/null 2>&1\n${runCmd}\n`);
        } catch (err) {
          console.error('[PTY RUN FILE ERROR]', err.message);
        }
      }
    });

    // =====================================
    // TERMINAL RESIZE
    // =====================================
    socket.on('terminal-resize', ({ cols, rows }) => {
      if (ptyProcess) {
        try {
          ptyProcess.resize(cols, rows);
        } catch (err) {
          console.warn('Resize failed:', err.message);
        }
      }
    });

    // =====================================
    // DISCONNECT
    // =====================================
    socket.on('disconnect', () => {
      console.log('Terminal disconnected:', socket.id);

      // DO NOT kill immediately
      // browser reconnects can trigger disconnect events
      setTimeout(() => {
        try {
          if (ptyProcess && !socket.connected) {
            console.log('[KILLING PTY AFTER DISCONNECT]');
            ptyProcess.kill();
            ptyProcess = null;
            activePtys.delete(socket.id);
          }
        } catch (err) {
          console.warn('PTY kill failed:', err.message);
        }
      }, 5000);
    });
  });
};
