import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, X, Plus, Power, ArrowLeft, RefreshCw } from 'lucide-react';

const APP_ENV = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || ''
};

const TerminalInstance = ({ session, isActive }: { session: any, isActive: boolean }) => {
  const [terminalState, setTerminalState] = useState('initializing');
  const [statusMessage, setStatusMessage] = useState('Starting Lab Environment...');

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  const initConnection = () => {
    setTerminalState('initializing');
    setStatusMessage('Starting Lab Environment...');

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socketUrl = APP_ENV.apiBaseUrl ? APP_ENV.apiBaseUrl.replace(/\/api$/, '') : `${window.location.protocol}//${window.location.hostname}:8080`;
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
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      socket.emit('terminal-input', data);
    });

    socket.on('terminal-output', (data) => {
      term.write(data);
    });

    socket.on('terminal-status', (payload) => {
      if (payload.status === 'timeout') {
        setTerminalState('timeout');
      } else if (payload.status === 'ready') {
        term.reset();
        setTerminalState('ready');
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
  }, []);

  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current && socketRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          socketRef.current.emit('terminal-resize', {
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows
          });
        } catch (e) { }
      }, 50);
    }
  }, [isActive]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (terminalState === 'initializing' || terminalState === 'polling') {
      timer = setTimeout(() => {
        if (terminalState !== 'ready') {
          setTerminalState('timeout');
          setStatusMessage('Lab is taking longer than expected.');
        }
      }, 65000);
    }
    return () => clearTimeout(timer);
  }, [terminalState]);

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
      {terminalState !== 'ready' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0c0c0c] text-white">
          <div className="flex flex-col items-center gap-6 p-8 rounded-xl bg-[#1e1e1e] border border-black/40 shadow-2xl">
            {terminalState === 'timeout' || terminalState === 'error' ? (
              <div className="text-red-500 bg-red-500/10 p-4 rounded-full">
                <Power size={48} />
              </div>
            ) : (
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            )}
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-wide text-slate-200 mb-2">
                {terminalState === 'timeout' ? 'Connection Timeout' :
                  terminalState === 'error' ? 'Connection Error' :
                    'Connecting to Lab'}
              </h2>
              <p className="text-sm text-slate-400 font-mono">
                {statusMessage}
              </p>
            </div>
            {(terminalState === 'timeout' || terminalState === 'error') && (
              <button
                onClick={initConnection}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded shadow-lg shadow-red-500/20"
              >
                <RefreshCw size={16} />
                Retry Connection
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="h-full w-full p-0 absolute inset-0"
        style={{
          opacity: terminalState === 'ready' ? 1 : 0,
          visibility: terminalState === 'ready' ? 'visible' : 'hidden',
        }}
      >
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
};

const Terminal = ({ session, hideHeader, onStopLab, onBack }: any) => {
  const [tabs, setTabs] = useState([
    { id: 'default', name: 'bash' }
  ]);
  const [activeTabId, setActiveTabId] = useState('default');

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
          />
        ))}
      </div>
    </div>
  );
};

export default Terminal;
