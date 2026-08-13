import React, { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  Play, RotateCw, ExternalLink, Terminal, Loader2, ChevronDown, ChevronUp,
  RefreshCw, Wifi, WifiOff, Trash2, Download, AlertTriangle, Globe,
  PlayCircle, CheckCircle2, XCircle, Pause, X, ArrowLeft, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiOrigin } from '@/config/env';

// State Machine Types
export type SeleniumState =
  | 'IDLE'
  | 'STARTING'
  | 'CONNECTING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'ERROR'
  | 'DISCONNECTED';

interface LogMessage {
  type: string;
  message: string;
  timestamp: string;
}

interface TestingWorkspaceProps {
  session: any;
  sessionId: string;
  runState: {
    status: SeleniumState;
    browserUrl: string | null;
    logStreamUrl: string | null;
    runId: string | null;
    errorMsg: string | null;
  };
  setRunState: React.Dispatch<React.SetStateAction<{
    status: SeleniumState;
    browserUrl: string | null;
    logStreamUrl: string | null;
    runId: string | null;
    errorMsg: string | null;
  }>>;
  onRun: () => Promise<any>;
  onClose?: () => void;
  initialAddressUrl?: string;
}

export const TestingWorkspace = React.forwardRef<any, TestingWorkspaceProps>(({
  session,
  sessionId,
  runState,
  setRunState,
  onRun,
  onClose,
  initialAddressUrl
}, ref) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [addressBarUrl, setAddressBarUrl] = useState(initialAddressUrl || 'http://example.com/login');

  useEffect(() => {
    if (initialAddressUrl) {
      setAddressBarUrl(initialAddressUrl);
    }
  }, [initialAddressUrl]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);


  // Clean logs buffer length optimization
  const visibleLogs = useMemo(() => {
    if (logs.length > 1000) {
      return logs.slice(logs.length - 1000);
    }
    return logs;
  }, [logs]);

  // Handle Log Stream (SSE EventSource)
  const connectSSE = (url: string) => {
    // Clean up existing SSE connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const fullUrl = url.startsWith('http') ? url : `${getApiOrigin()}${url}`;
    const es = new EventSource(fullUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle heartbeat
        if (data.type === 'heartbeat') return;

        // Append to logs
        if (data.message) {
          setLogs(prev => [...prev, data]);
        }

        // Handle State Machine transitions driven by backend SSE
        if (data.type === 'status') {
          const msg = data.message.toLowerCase();

          // Parse navigated URL to update address bar URL
          if (msg.includes('navigating to') || msg.includes('navigating')) {
            const urlMatch = data.message.match(/https?:\/\/[^\s'"]+/);
            if (urlMatch) {
              setAddressBarUrl(urlMatch[0]);
            }
          }

          if (msg.includes('starting selenium')) {
            setRunState(prev => ({ ...prev, status: 'STARTING' }));
          } else if (msg.includes('launching chrome')) {
            setRunState(prev => ({ ...prev, status: 'STARTING' }));
          } else if (msg.includes('connecting to browser')) {
            setRunState(prev => ({ ...prev, status: 'CONNECTING' }));
          } else if (msg.includes('browser connected')) {
            setRunState(prev => ({ ...prev, status: 'RUNNING' }));
          } else if (msg.includes('test passed')) {
            setRunState(prev => ({ ...prev, status: 'PASSED' }));
            es.close();
          } else if (msg.includes('test failed')) {
            setRunState(prev => ({ ...prev, status: 'FAILED' }));
            es.close();
          }
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    es.onerror = () => {
      console.warn('SSE stream error, attempting to reconnect...');
      // Transition to disconnected state only if we were actively running or connecting
      setRunState(prev => {
        if (prev.status === 'RUNNING' || prev.status === 'CONNECTING' || prev.status === 'STARTING') {
          toast.error('Log stream disconnected. Reconnecting...');
          return { ...prev, status: 'DISCONNECTED' };
        }
        return prev;
      });
    };
  };

  // Trigger Run workflow
  const handleExecute = async () => {
    setLogs([]);
    setElapsedSeconds(0);
    setExpandedLogs(true);

    try {
      await onRun();
    } catch (err: any) {
      toast.error(err.message || 'Error executing test script');
    }
  };

  // Toolbar Actions
  const handleRefreshBrowser = () => {
    setIframeKey(prev => prev + 1);
    toast.success('Reloading browser iframe');
  };

  const handleReconnect = () => {
    if (runState.logStreamUrl) {
      setRunState(prev => ({ ...prev, status: prev.status === 'DISCONNECTED' ? 'CONNECTING' : prev.status }));
      connectSSE(runState.logStreamUrl);
      toast.info('Reconnecting logs stream...');
    } else {
      toast.error('No active logs stream URL to reconnect');
    }
  };

  const handleRestartBrowser = () => {
    handleExecute();
  };

  const handleOpenNewTab = () => {
    if (runState.browserUrl) {
      window.open(runState.browserUrl, '_blank');
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    toast.success('Logs cleared');
  };

  const handleDownloadLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.type}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `selenium-run-${runState.runId || 'logs'}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Execution Timer
  useEffect(() => {
    if (['STARTING', 'CONNECTING', 'RUNNING'].includes(runState.status)) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runState.status]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Connect to SSE stream automatically when backend sets the stream URL
  useEffect(() => {
    if (runState.logStreamUrl) {
      connectSSE(runState.logStreamUrl);
    }
  }, [runState.logStreamUrl]);

  // Auto Scroll Logs
  useEffect(() => {
    if (autoScroll && !isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  useImperativeHandle(ref, () => ({
    runTest: handleExecute
  }));

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <BrowserLayout
      header={
        <BrowserToolbar
          status={runState.status}
          addressUrl={addressBarUrl}
          onRefresh={handleRefreshBrowser}
          onOpenNewTab={handleOpenNewTab}
        />
      }
      body={
        <BrowserBody
          status={runState.status}
          browserUrl={runState.browserUrl}
          iframeKey={iframeKey}
          errorMsg={runState.errorMsg}
          onRun={handleExecute}
        />
      }
      logs={
        <ExecutionLogs
          logs={visibleLogs}
          expanded={expandedLogs}
          setExpanded={setExpandedLogs}
          autoScroll={autoScroll}
          setAutoScroll={setAutoScroll}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
          onClear={handleClearLogs}
          onDownload={handleDownloadLogs}
          logsEndRef={logsEndRef}
        />
      }
    />
  );
});

// ==========================================
// SUB-COMPONENT: BROWSER LAYOUT
// ==========================================
interface BrowserLayoutProps {
  header: React.ReactNode;
  body: React.ReactNode;
  logs: React.ReactNode;
}

const BrowserLayout: React.FC<BrowserLayoutProps> = ({ header, body, logs }) => {
  return (
    <div className="w-full bg-[#0c0c0c] flex flex-col h-full overflow-hidden transition-all duration-300">
      {header}
      <div className="flex-1 min-h-0 relative flex flex-col">
        {body}
      </div>
      {logs}
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: BROWSER TOOLBAR
// ==========================================
interface BrowserToolbarProps {
  status: SeleniumState;
  addressUrl: string;
  onRefresh: () => void;
  onOpenNewTab: () => void;
}

const BrowserToolbar: React.FC<BrowserToolbarProps> = ({
  status,
  addressUrl,
  onRefresh,
  onOpenNewTab
}) => {
  return (
    <div className="h-10 bg-[#2d2d2d] border-b border-[#1f1f1f] px-3 flex items-center gap-3 select-none shrink-0 w-full text-slate-300">
      {/* Navigation arrows */}
      <div className="flex items-center gap-1">
        <button
          disabled
          className="p-1 hover:bg-white/5 rounded text-slate-600 cursor-not-allowed transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          disabled
          className="p-1 hover:bg-white/5 rounded text-slate-600 cursor-not-allowed transition-colors"
          title="Forward"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRefresh}
          className="p-1 hover:bg-white/5 rounded hover:text-white cursor-pointer transition-colors"
          title="Reload"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Address Bar */}
      <div className="flex-1 min-w-0">
        <div className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-1 text-[11px] font-mono text-slate-300 select-all truncate select-text cursor-default">
          {addressUrl}
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Connection status badge */}
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border ${status === 'RUNNING' || status === 'PASSED' || status === 'FAILED'
            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30'
            : status === 'DISCONNECTED' || status === 'ERROR'
              ? 'text-red-400 bg-red-950/40 border-red-900/30'
              : 'text-amber-400 bg-amber-950/40 border-amber-900/30'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'RUNNING' || status === 'PASSED' || status === 'FAILED'
              ? 'bg-emerald-400 animate-pulse'
              : status === 'DISCONNECTED' || status === 'ERROR'
                ? 'bg-red-500'
                : 'bg-amber-400 animate-bounce'
            }`} />
          {status === 'RUNNING' || status === 'PASSED' || status === 'FAILED'
            ? 'Connected'
            : status === 'DISCONNECTED'
              ? 'Disconnected'
              : status === 'ERROR'
                ? 'Error'
                : 'Connecting'}
        </span>

        {/* External Link button */}
        <button
          onClick={onOpenNewTab}
          title="Open Browser in New Tab"
          className="p-1 hover:bg-white/5 rounded hover:text-white cursor-pointer transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: BROWSER BODY MULTIPLEXER
// ==========================================
interface BrowserBodyProps {
  status: SeleniumState;
  browserUrl: string | null;
  iframeKey: number;
  errorMsg: string | null;
  onRun: () => void;
}

const BrowserBody: React.FC<BrowserBodyProps> = ({
  status,
  browserUrl,
  iframeKey,
  errorMsg,
  onRun
}) => {
  if (status === 'IDLE') {
    return <BrowserEmptyState onRun={onRun} />;
  }

  if (status === 'ERROR') {
    return <BrowserErrorState errorType="LAUNCH_FAIL" errorMsg={errorMsg} onRetry={onRun} />;
  }

  if (status === 'DISCONNECTED' && !browserUrl) {
    return <BrowserErrorState errorType="DISCONNECTED" errorMsg="Lost connection to the browser environment." onRetry={onRun} />;
  }

  return (
    <div className="absolute inset-0 w-full h-full flex flex-col bg-[#0a0a0a]">
      {(!browserUrl && (status === 'STARTING' || status === 'CONNECTING')) && (
        <BrowserLoader status={status} />
      )}

      {browserUrl && (
        <BrowserViewer
          url={browserUrl}
          iframeKey={iframeKey}
          visible={true}
        />
      )}
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: EMPTY STATE
// ==========================================
const BrowserEmptyState: React.FC<{ onRun: () => void }> = ({ onRun }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#0c0c0c] border border-white/5 m-3 rounded-lg select-none">
      <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-4">
        <Globe className="w-6 h-6 text-white/40" />
      </div>
      <h3 className="text-white font-mono text-sm font-semibold tracking-wide mb-1 uppercase">Browser Preview</h3>
      <p className="text-white/40 text-xs font-mono max-w-xs mb-5">
        No browser session running. Run your Selenium test to launch a live browser inside the lab.
      </p>
      <button
        onClick={onRun}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-emerald-500/20 bg-emerald-950/20 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 cursor-pointer"
      >
        <PlayCircle className="w-4 h-4" /> Run Test
      </button>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: LOADER OVERLAY
// ==========================================
const BrowserLoader: React.FC<{ status: SeleniumState }> = ({ status }) => {
  const message = useMemo(() => {
    if (status === 'STARTING') {
      return 'Starting Selenium Environment...';
    }
    return 'Connecting to Chrome...';
  }, [status]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0c0c0c] text-center p-6">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
      <h4 className="text-white text-xs font-mono font-bold tracking-wide uppercase mb-1">{message}</h4>
      <p className="text-white/30 text-[10px] font-mono">Launching container services...</p>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: BROWSER VIEWER
// ==========================================
interface BrowserViewerProps {
  url: string;
  iframeKey: number;
  visible: boolean;
}

const BrowserViewer: React.FC<BrowserViewerProps> = ({ url, iframeKey, visible }) => {
  return (
    <div
      className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ display: visible ? 'block' : 'none' }}
    >
      <iframe
        key={iframeKey}
        src={url}
        className="w-full h-full border-0 select-none bg-black"
        title="Selenium Live Browser"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: ERROR STATE
// ==========================================
interface BrowserErrorStateProps {
  errorType: 'LAUNCH_FAIL' | 'DISCONNECTED' | 'TIMEOUT';
  errorMsg: string | null;
  onRetry: () => void;
}

const BrowserErrorState: React.FC<BrowserErrorStateProps> = ({
  errorType,
  errorMsg,
  onRetry
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#0d0d0d] border border-red-950/20 m-3 rounded-lg">
      <div className="w-12 h-12 bg-red-950/30 border border-red-900/30 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <h3 className="text-red-500 font-mono text-sm font-semibold tracking-wide mb-1 uppercase">
        {errorType === 'DISCONNECTED' ? 'Browser Disconnected' : 'Execution Failed'}
      </h3>
      <p className="text-white/50 text-xs font-mono max-w-sm mb-5 whitespace-pre-wrap">
        {errorMsg || 'Failed to complete execution due to connection timeouts or runtime failures.'}
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-red-500/20 bg-red-950/20 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 cursor-pointer"
      >
        <RotateCw className="w-4 h-4 animate-pulse" /> Retry Run
      </button>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: EXECUTION LOGS TERMINAL
// ==========================================
interface ExecutionLogsProps {
  logs: LogMessage[];
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;
  isPaused: boolean;
  setIsPaused: (isPaused: boolean) => void;
  onClear: () => void;
  onDownload: () => void;
  logsEndRef: React.RefObject<HTMLDivElement | null>;
}

const ExecutionLogs: React.FC<ExecutionLogsProps> = ({
  logs,
  expanded,
  setExpanded,
  autoScroll,
  setAutoScroll,
  isPaused,
  setIsPaused,
  onClear,
  onDownload,
  logsEndRef
}) => {
  const [height, setHeight] = useState(256);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 150, startHeight + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getLogLineColorClass = (msg: string) => {
    const text = msg.toLowerCase();
    if (text.includes('test passed') || text.includes('success') || text.includes('🟢')) {
      return 'text-emerald-400 font-bold';
    }
    if (text.includes('fail') || text.includes('error') || text.includes('🔴') || text.includes('❌')) {
      return 'text-rose-400 font-bold';
    }
    if (text.includes('warning') || text.includes('🟡') || text.includes('connecting')) {
      return 'text-amber-400';
    }
    if (msg.startsWith('>')) {
      return 'text-sky-400';
    }
    return 'text-slate-300';
  };

  return (
    <div
      className={`relative border-t border-[#222] bg-[#111111] flex flex-col shrink-0 ${!expanded ? 'h-9 transition-all duration-300' : ''}`}
      style={expanded ? { height: `${height}px` } : undefined}
    >
      {expanded && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-emerald-500/50 hover:h-1.5 transition-all z-50"
        />
      )}
      <div
        onClick={() => setExpanded(!expanded)}
        className="h-9 hover:bg-[#181818] cursor-pointer flex items-center justify-between px-3 select-none border-b border-[#222]"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-white/50" />
          <span className="text-[10px] font-bold text-white/70 font-mono uppercase tracking-wider">Execution Logs</span>
          <span className="text-[9px] text-white/30 font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
            {logs.length} lines
          </span>
        </div>
        <div className="flex items-center gap-1">
          {expanded ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronUp className="w-4 h-4 text-white/50" />}
        </div>
      </div>

      {expanded && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d]">
          <div className="h-8 border-b border-[#1b1b1b] bg-[#141414] px-3 flex items-center justify-between select-none shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setAutoScroll(!autoScroll); }}
                className={`text-[9px] font-mono border px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer ${autoScroll ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400' : 'border-white/10 text-white/40 hover:bg-white/5'}`}
              >
                Auto-Scroll
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused); }}
                className={`text-[9px] font-mono border px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer ${isPaused ? 'border-amber-500/20 bg-amber-950/20 text-amber-400' : 'border-white/10 text-white/40 hover:bg-white/5'}`}
              >
                {isPaused ? <Play className="w-2.5 h-2.5 inline" /> : <Pause className="w-2.5 h-2.5 inline" />} {isPaused ? 'Resume' : 'Pause'}
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                title="Clear Logs"
                className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                title="Download Full Logs"
                className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed selection:bg-emerald-500/20 selection:text-emerald-200">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/20 select-none">
                No execution logs yet. Run a Selenium test to see output logs.
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-white/20 select-none text-[9px] leading-relaxed w-14 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={getLogLineColorClass(log.message)}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
