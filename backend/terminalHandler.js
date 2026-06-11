import pty from 'node-pty';
import os from 'os';
import fs from 'fs';
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
        const interactiveShell = '/bin/bash';

        console.log('Connecting terminal to ECS container via /bin/sh...');

        // =====================================
        // AWS CLI PATH & DYNAMIC FALLBACK
        // =====================================
        let awsExePath = 'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe';
        const localPipAwsPath = 'C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\aws';
        const localPythonExe = 'C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe';
        
        let isLocalWinSetup = false;
        let awsExists = fs.existsSync(awsExePath);

        if (!awsExists && os.platform() === 'win32' && fs.existsSync(localPipAwsPath) && fs.existsSync(localPythonExe)) {
          // absolute python path is mandatory for node-pty to prevent "File not found" errors
          awsExePath = localPythonExe;
          isLocalWinSetup = true;
          awsExists = true;
        }

        console.log('AWS CLI Exists:', awsExists);
        
        if (!awsExists) {
          throw new Error('AWS CLI not installed');
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
          
          // Poll for up to 60 seconds (30 iterations * 2s)
          for (let i = 0; i < 30; i++) {
            const taskDetails = await describeTask(session.taskArn);
            
            if (taskDetails) {
              const container = taskDetails.containers?.find(c => c.name === 'lab-runtime') || taskDetails.containers?.[0];
              if (container && container.name) {
                actualContainerName = container.name;
              }
              
              const execAgent = container?.managedAgents?.find(a => a.name === 'ExecuteCommandAgent');
              
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

        // =====================================
        // SESSION MANAGER PLUGIN VERIFICATION
        // =====================================
        const standardSsmPath = 'C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin\\session-manager-plugin.exe';
        const localPipSsmPath = 'C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\session-manager-plugin.exe';
        const ssmExists = fs.existsSync(standardSsmPath) || fs.existsSync(localPipSsmPath);

        console.log('Session Manager Plugin Exists:', ssmExists);
        
        if (!ssmExists) {
          throw new Error('AWS Session Manager Plugin not installed');
        }

        const region = process.env.AWS_REGION || 'ap-south-1';

        const ptyArgs = [
          'ecs', 'execute-command',
          '--cluster', cluster,
          '--task', taskId,
          '--container', actualContainerName,
          '--interactive',
          '--command', interactiveShell,
          '--region', region,
        ];

        if (isLocalWinSetup) {
          ptyArgs.unshift(localPipAwsPath);
        }

        const ptyEnv = { ...process.env };
        const pathDelimiter = os.platform() === 'win32' ? ';' : ':';
        const pathKey = Object.keys(ptyEnv).find(k => k.toUpperCase() === 'PATH') || 'PATH';

        // Ensure both Session Manager Plugin directories (standard and local pip scripts) are explicitly in PATH
        const additions = [
          'C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin',
          'C:\\Users\\Hackberry Softech\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts'
        ];
        const pathString = additions.join(pathDelimiter);
        ptyEnv[pathKey] = `${pathString}${pathDelimiter}${ptyEnv[pathKey] || ''}`;

        console.log('[AWS Execute-Command Config]', {
          taskId,
          cluster,
          containerName: actualContainerName,
          awsExePath,
          ptyArgs,
        });

        ptyProcess = pty.spawn(awsExePath, ptyArgs, {
          name: 'xterm-color',
          cols: 120,
          rows: 30,
          cwd: process.cwd(),
          useConpty: false, // Force WinPTY to prevent ConPTY from intercepting/translating VT sequences (arrow keys)
          env: {
            ...ptyEnv,
            TERM: 'xterm-256color',
            AWS_PAGER: '',
          },
        });

        activePtys.set(socket.id, ptyProcess);

        isContainer = true;
        console.log('[SUCCESS] ECS terminal connected');
        
      } catch (err) {
        console.error('[ECS TERMINAL FAILED]', err.message);
        socket.emit('terminal-output', `\r\n\x1b[31m[ECS TERMINAL FAILED: ${err.message}]\x1b[0m\r\n`);
      }
    }

    // =====================================
    // LOCAL FALLBACK
    // =====================================
    if (!ptyProcess) {
      console.log('[LOCAL FALLBACK TERMINAL]');
      try {
        ptyProcess = pty.spawn(LOCAL_SHELL, [], {
          name: 'xterm-color',
          cols: 120,
          rows: 30,
          cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
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
