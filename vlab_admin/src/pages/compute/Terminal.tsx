import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import { getApiOrigin } from '@/config/env';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, X, Plus, Power, ArrowLeft, RefreshCw, Clock } from 'lucide-react';

const TerminalInstance = forwardRef(({ session, isActive, onTerminalCommand, isLabBusy }: { session: any, isActive: boolean, onTerminalCommand?: () => void, isLabBusy?: boolean }, ref) => {
  const [terminalState, setTerminalState] = useState('initializing');
  const [statusMessage, setStatusMessage] = useState('Connecting...');

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    runFile: (file: any) => {
      if (socketRef.current && terminalState === 'ready') {
        socketRef.current.emit('terminal-run-file', {
          path: file.path,
          content: file.content,
          language: file.language
        });
      }
    }
  }));

  const initConnection = () => {
    if (isLabBusy) {
      setTerminalState('waiting');
      setStatusMessage('BUILD/RUN is in progress. The terminal shares one AWS connection with the container — wait for it to finish.');
      return () => {};
    }

    setTerminalState('initializing');
    setStatusMessage('Connecting...');

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socketUrl = getApiOrigin();
    const socket = io(socketUrl, {
      query: {
        sessionId: session?.sessionId || '',
      },
    });
    socketRef.current = socket;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#f00',
        selectionBackground: 'rgba(239, 68, 68, 0.3)',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
      term.focus();
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      socket.emit('terminal-input', data);
      if (data.includes('\r') || data.includes('\n')) {
        onTerminalCommand?.();
      }
    });

    socket.on('terminal-output', (data) => {
      term.write(data);
      if (typeof data === 'string' && (data.includes("execute command agent isn't running") || data.includes('Terminal exited with code 254'))) {
        setTerminalState('timeout');
        setStatusMessage('Container agent is initializing. Reconnecting in 3s...');
        setTimeout(() => {
          initConnection();
        }, 3000);
      }
    });

    socket.on('terminal-status', (payload) => {
      if (payload.status === 'timeout') {
        setTerminalState('timeout');
      } else if (payload.status === 'ready') {
        setTerminalState('ready');
        setTimeout(() => {
          try { term.focus(); } catch (e) {}
        }, 30);
      } else {
        setTerminalState(payload.status);
      }
      if (payload.message) {
        setStatusMessage(payload.message);
      }
    });

    socket.on('connect', () => {
      const dims = { cols: term.cols, rows: term.rows };
      socket.emit('terminal-resize', dims);
    });

    socket.on('disconnect', () => {
      setTerminalState('error');
      setStatusMessage('Disconnected from Server');
    });

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        socket.emit('terminal-resize', {
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      term.dispose();
    };
  };

  useEffect(() => {
    const cleanup = initConnection();
    return () => {
      cleanup();
    };
  }, [isLabBusy]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (terminalState === 'initializing' || terminalState === 'polling') {
      timer = setTimeout(() => {
        setTerminalState((prev) => {
          if (prev === 'initializing' || prev === 'polling') {
            setStatusMessage(
              'Could not open a shell in the container. If BUILD/RUN is active, wait for it to finish and click Retry. The lab uses AWS SSM (not a direct browser link to the container).',
            );
            return 'timeout';
          }
          return prev;
        });
      }, 180000);
    }
    return () => clearTimeout(timer);
  }, [terminalState]);

  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current && socketRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          xtermRef.current.focus();
          socketRef.current.emit('terminal-resize', {
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows
          });
        } catch (e) { }
      }, 50);
    }
  }, [isActive]);

  return (
    <div
      className="absolute inset-0 flex-1 flex flex-col bg-[#0c0c0c] overflow-hidden"
      style={{
        opacity: isActive ? 1 : 0,
        visibility: isActive ? 'visible' : 'hidden',
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 10 : 0
      }}
    >


      {/* Non-blocking error/timeout notification banner */}
      {(terminalState === 'timeout' || terminalState === 'error') && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-[#1e1e1e]/95 backdrop-blur border border-red-500/50 px-4 py-2 rounded-lg shadow-2xl text-xs text-white max-w-lg">
          <Power size={14} className="text-red-500 shrink-0" />
          <span className="font-mono text-[11px] text-slate-300 truncate">{statusMessage}</span>
          <button
            onClick={initConnection}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-[11px] font-bold shadow transition-colors shrink-0"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Non-blocking waiting banner */}
      {terminalState === 'waiting' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-[#1e1e1e]/95 backdrop-blur border border-amber-500/50 px-4 py-2 rounded-lg shadow-2xl text-xs text-white max-w-lg">
          <RefreshCw size={14} className="text-amber-400 shrink-0 animate-spin" />
          <span className="font-mono text-[11px] text-slate-300 truncate">{statusMessage}</span>
        </div>
      )}

      <div
        className="h-full w-full p-0 absolute inset-0 opacity-100 visible"
      >
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
});

const Terminal = forwardRef(({ session, hideHeader, onStopLab, onBack, onClose, onTerminalCommand, isLabBusy, remainingTime }: any, ref) => {
  const [tabs, setTabs] = useState([
    { id: 'default', name: 'bash' }
  ]);
  const [activeTabId, setActiveTabId] = useState('default');
  const activeInstanceRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    runFile: (file: any) => {
      if (activeInstanceRef.current) {
        activeInstanceRef.current.runFile(file);
      }
    }
  }));

  const addNewTab = () => {
    const newId = Date.now().toString();
    setTabs(prev => [...prev, { id: newId, name: `bash (${prev.length + 1})` }]);
    setActiveTabId(newId);
  };

  const closeTab = (e: any, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  return (
    <div className="h-full w-full bg-[#0c0c0c] flex flex-col overflow-hidden relative">
      {!hideHeader && (
        <div className="h-9 bg-[#1e1e1e] flex items-center px-2 border-b border-black/40 shrink-0 overflow-x-auto no-scrollbar z-20 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-3 h-full cursor-pointer transition-all border-r border-black/20 min-w-[120px] max-w-[200px] ${activeTabId === tab.id
                ? 'bg-[#0c0c0c] border-t-2 border-t-red-500 text-slate-200'
                : 'hover:bg-[#2a2d2e] text-slate-500'
                }`}
            >
              <TerminalIcon size={14} className={activeTabId === tab.id ? 'text-emerald-500' : 'text-slate-600'} />
              <span className="text-[11px] font-bold truncate flex-1">{tab.name}</span>
              {tabs.length > 1 && (
                <X
                  size={14}
                  className="hover:bg-white/10 rounded p-0.5 text-slate-500 hover:text-white"
                  onClick={(e) => closeTab(e, tab.id)}
                />
              )}
            </div>
          ))}

          <div
            onClick={addNewTab}
            className="flex items-center gap-1 px-3 h-full cursor-pointer text-slate-500 hover:text-slate-300 hover:bg-[#2a2d2e] transition-all"
          >
            <Plus size={16} />
            <span className="text-[10px] font-bold whitespace-nowrap">New Terminal</span>
          </div>

          <div className="flex-1" />

          {remainingTime && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/60 text-white font-mono text-xs font-bold shrink-0 mr-3 shadow-sm">
              <Clock size={14} className="text-white shrink-0" />
              <span className="text-white font-bold tracking-wider text-[11px]">TIME REMAINING:</span>
              <span className="text-white font-extrabold tracking-wider bg-red-600 px-2 py-0.5 rounded border border-red-400/50 text-xs">
                {remainingTime}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 mr-2">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-[9px] font-black h-7 px-4 bg-red-600 text-white shadow-lg shadow-red-600/20 uppercase tracking-widest transition-all shrink-0 rounded"
              >
                <ArrowLeft size={14} />
                Back to Dashboard
              </button>
            )}

            {onStopLab && (
              <button
                onClick={onStopLab}
                className="flex items-center gap-1 text-[9px] font-black h-7 px-4 bg-red-600 text-white shadow-lg shadow-red-600/20 uppercase tracking-widest transition-all shrink-0 rounded"
              >
                <Power size={14} />
                Stop Lab
              </button>
            )}
          </div>
        </div>
      )}

      {/* Terminal Content Area */}
      <div className="flex-1 relative bg-[#0c0c0c] overflow-hidden">
        {tabs.map((tab) => (
          <TerminalInstance
            key={tab.id}
            session={session}
            isActive={activeTabId === tab.id}
            ref={activeTabId === tab.id ? activeInstanceRef : null}
            onTerminalCommand={onTerminalCommand}
            isLabBusy={isLabBusy}
          />
        ))}
      </div>
    </div>
  );
});

export default Terminal;
