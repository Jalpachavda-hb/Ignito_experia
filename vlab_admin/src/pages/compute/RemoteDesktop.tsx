import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth-store';
import { useLabSessionStore } from '@/stores/labSessionStore';
import {
  fetchUserActiveSession,
  startLabSession,
  fetchLabSessionStatus,
  stopLabSession,
  waitForLabSessionReady,
  fetchJupyterHealth,
} from '@/services/labService';
import CloudEditor from './Editor';
import Terminal from './Terminal';
import { SessionTimeoutModal } from '../student/my-labs/components/session-timeout-modal';
import { ArrowLeft, Power } from 'lucide-react';

const APP_ENV = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || ''
};

const resolveToolUrl = (url: string) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const apiBase = APP_ENV.apiBaseUrl || '';
  if (apiBase) {
    try {
      const parsed = new URL(apiBase);
      return `${parsed.origin}${url}`;
    } catch {
      return url;
    }
  }
  return `${window.location.protocol}//${window.location.hostname}:8080${url}`;
};

const getLabToolUrl = (session: any) => {
  if (!session) return null;
  const isJupyter = session.tools?.main?.type === 'jupyter' || session.tools?.jupyter?.enabled;

  if (isJupyter) {
    if (session.tools?.jupyter?.url) return resolveToolUrl(session.tools.jupyter.url);
    if (session.tools?.main?.url) return resolveToolUrl(session.tools.main.url);
    return null;
  }

  if (session.tools?.main?.url) return resolveToolUrl(session.tools.main.url);
  if (session.publicIp) {
    const port = session.tools?.main?.port || session.containerPort || 8080;
    return `http://${session.publicIp}:${port}/`;
  }
  return null;
};

const isDataScienceLab = (labId: string, session: any) =>
  labId === 'data-science-lab' || session?.tools?.main?.type === 'jupyter';

const shouldUseCodeServer = (session: any, labId: string) => {
  const lid = (session?.labId || labId || '').toLowerCase();
  return (
    lid.includes('testing') ||
    lid.includes('dotnet') ||
    lid.includes('mobile') ||
    lid.includes('software')
  );
};

const shouldUseBuiltInEditor = (session: any, labId: string) => {
  const lid = (session?.labId || labId || '').toLowerCase();
  if (shouldUseCodeServer(session, labId)) return false;
  return (
    session?.tools?.main?.type === 'ide' ||
    ['python-lab', 'java-lab'].includes(lid) ||
    lid.includes('big-data') ||
    lid.includes('bigdata') ||
    lid.includes('analytics') ||
    lid.includes('agile')
  );
};



interface EmbedProps {
  url: string;
  sessionId?: string;
  onStopLab: () => void;
  onBack: () => void;
}

const JupyterEmbed = ({ url, sessionId, onStopLab, onBack }: EmbedProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [iframeSrc, setIframeSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIframeSrc('');

    const run = async () => {
      if (sessionId) {
        for (let i = 0; i < 45; i++) {
          if (cancelled) return;
          try {
            const health = await fetchJupyterHealth(sessionId);
            if (health.ready) {
              // Wait an additional 3 seconds after health passes to ensure nginx proxy is fully bound
              await new Promise((r) => setTimeout(r, 3000));
              break;
            }
          } catch { }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!cancelled) {
        // Append cache buster to prevent the browser from caching a 502 page
        const cacheBustedUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
        setIframeSrc(cacheBustedUrl);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [url, sessionId]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
      <div className="bg-[#1e1e1e] border-b border-white/10 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-white text-sm font-black uppercase tracking-wide">Data Science Lab</span>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-[9px] font-black h-7 px-4 bg-red-600 text-white uppercase tracking-widest shrink-0 rounded">
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <button onClick={onStopLab} className="flex items-center gap-1 text-[9px] font-black h-7 px-4 bg-red-600 text-white uppercase tracking-widest shrink-0 rounded">
            <Power size={14} /> Stop Lab
          </button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 bg-white">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#1e1e1e]">
            <div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-sm font-bold uppercase tracking-widest">Starting notebook...</span>
          </div>
        )}
        {iframeSrc && (
          <iframe src={iframeSrc} title="JupyterLab" className="absolute inset-0 h-full w-full border-0" allow="clipboard-read; clipboard-write; fullscreen" onLoad={() => setIsLoading(false)} />
        )}
      </div>
    </div>
  );
};

interface IframeToolProps extends EmbedProps {
  title?: string;
  isJupyter?: boolean;
}

const IframeTool = ({ url, title, onStopLab, onBack, isJupyter, sessionId }: IframeToolProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [iframeSrc, setIframeSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    setIframeSrc('');

    const run = async () => {
      if (isJupyter && sessionId) {
        let reachable = false;
        let lastErrorMsg = '';
        for (let i = 0; i < 30; i++) {
          if (cancelled) return;
          try {
            const health = await fetchJupyterHealth(sessionId);
            if (health.ready) { reachable = true; break; }
            lastErrorMsg = health.message;
          } catch (err: any) {
            if (err?.status === 404) { reachable = true; break; }
            lastErrorMsg = err.message;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (cancelled) return;
        if (!reachable) {
          setLoadError(lastErrorMsg || 'Cannot reach Jupyter. Open inbound TCP 8080 on the ECS security group.');
          setIsLoading(false);
          return;
        }
        // Wait an additional 3 seconds after health passes to ensure nginx proxy is fully bound
        await new Promise((r) => setTimeout(r, 3000));
      } else if (!isJupyter && url) {
        let reachable = false;
        let lastErrorMsg = '';
        for (let i = 0; i < 150; i++) {
          if (cancelled) return;
          try {
            // Guarantee we bypass browser cache for the health poll
            const pollUrl = url.includes('?') ? `${url}&health=${Date.now()}` : `${url}?health=${Date.now()}`;
            const res = await fetch(pollUrl, { method: 'GET', mode: 'cors', cache: 'no-store' });
            if (res.status !== 502 && res.status !== 504 && res.status !== 503 && res.status !== 500) {
              reachable = true;
              break;
            }
            lastErrorMsg = `Proxy returned ${res.status}`;
          } catch (err: any) {
            lastErrorMsg = err.message;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (cancelled) return;
        if (!reachable) {
          setLoadError(lastErrorMsg || 'Cannot reach IDE on port 8080.');
          setIsLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        const cacheBustedUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
        setIframeSrc(cacheBustedUrl);
      }
    };

    run();
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setIsLoading((loading) => {
          if (loading) setLoadError('The lab IDE did not load in time. Open in a new tab.');
          return false;
        });
      }
    }, 300000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [url, isJupyter, sessionId]);

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e]">
      <div className="bg-[#2d2d2d] px-4 py-2 flex justify-between items-center border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <div className="text-white text-sm font-bold">{title || 'Lab Environment'}</div>
          <div className="text-slate-500 text-[10px] font-mono truncate max-w-[70vw]">{url}</div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-[10px] font-black uppercase hover:underline">Open in Tab</a>
          <button onClick={onBack} className="text-slate-400 text-[10px] font-black uppercase hover:underline">Dashboard</button>
          <button onClick={onStopLab} className="text-red-400 text-[10px] font-black uppercase hover:underline">Stop Lab</button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 bg-black">
        {(isLoading || loadError) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#1e1e1e] text-center px-6">
            <div className="text-white text-sm font-black uppercase tracking-widest">
              {loadError ? 'Could not embed IDE' : isJupyter ? 'Loading JupyterLab...' : 'Loading lab IDE...'}
            </div>
            <div className={`text-xs font-mono break-all max-w-2xl ${loadError ? 'text-amber-400' : 'text-slate-500'}`}>{loadError || url}</div>
            {loadError && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded">Open IDE in New Tab</a>
            )}
          </div>
        )}
        {iframeSrc && (
          <iframe src={iframeSrc} title="Lab Tool" className="absolute inset-0 h-full w-full border-none bg-white" allow="clipboard-read; clipboard-write; fullscreen; autoplay; microphone; camera" allowFullScreen onLoad={() => { setIsLoading(false); setLoadError(''); }} />
        )}
      </div>
    </div>
  );
};

export const RemoteDesktop = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [connecting, setConnecting] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState('');
  const initStartedRef = useRef(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const user = useAuthStore(state => state.auth.user);
  const { stopLab } = useLabSessionStore();

  const search = location.search as Record<string, string>;
  const labId = search.labId || '';
  const sessionIdParam = search.sessionId || '';

  useEffect(() => {
    const initializeSession = async () => {
      if (!labId || initStartedRef.current) return;
      if (!sessionIdParam && !user?.id) return; // Need user ID to fetch or start session

      initStartedRef.current = true;

      try {
        let activeSession = null;
        if (sessionIdParam) {
          activeSession = await fetchLabSessionStatus(sessionIdParam);
        } else if (user?.id) {
          const activeRes = await fetchUserActiveSession(user.id, labId);
          if (activeRes.session && activeRes.session.labId === labId) {
            activeSession = activeRes.session;
          } else {
            activeSession = await startLabSession({ labId, userId: user.id });
          }
        }
        if (!activeSession?.sessionId) throw new Error('No lab session available');
        const readySession = await waitForLabSessionReady(activeSession.sessionId, { maxAttempts: 90, intervalMs: 2000 });
        setSession(readySession);
        setConnecting(false);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize session');
        initStartedRef.current = false;
      }
    };
    initializeSession();
  }, [location.search, user?.id, sessionIdParam]);

  const handleStopLab = async () => {
    setIsStopping(true);
    try {
      if (session?.sessionId) {
        await stopLab(session.sessionId, session.labId);
        localStorage.removeItem(`lastGrade_${session.sessionId}`);
      }
      navigate({ to: '/student/my-labs' });
    } catch (err) {
      navigate({ to: '/student/my-labs' });
    } finally {
      setIsStopping(false);
      setShowStopModal(false);
    }
  };

  const handleRestartLab = async () => {
    setIsStopping(true);
    try {
      if (session?.sessionId) {
        await stopLab(session.sessionId, session.labId);
      }
      window.location.reload();
    } catch (err) {
      window.location.reload();
    }
  };

  const labToolUrl = getLabToolUrl(session);
  const resolvedLabId = (session?.labId || labId || '').toLowerCase();
  const isJupyterSession = isDataScienceLab(resolvedLabId, session) || session?.tools?.main?.type === 'jupyter';

  const stopLabDialog = showStopModal && (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] p-6 rounded-2xl max-w-sm w-full border border-white/10 text-center">
        <h2 className="text-white text-xl font-black uppercase tracking-tighter mb-6">Stop Lab Session?</h2>
        <div className="flex gap-3 w-full">
          <button onClick={() => setShowStopModal(false)} disabled={isStopping} className="flex-1 py-2 text-white bg-[#333] hover:bg-[#444] rounded">Cancel</button>
          <button onClick={handleStopLab} disabled={isStopping} className="flex-1 py-2 text-white bg-red-600 hover:bg-red-700 rounded">
            {isStopping ? 'Stopping...' : 'Stop Lab'}
          </button>
        </div>
      </div>
    </div>
  );

  if (connecting) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c0c0c] text-white">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-bold tracking-widest uppercase text-slate-300">Initializing Workspace</p>
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    );
  }

  const isTerminalSession = resolvedLabId.includes('linux') || resolvedLabId.includes('dbms') || resolvedLabId.includes('sql');

  if (session && isTerminalSession) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <Terminal session={session} hideHeader={false} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} />
        <SessionTimeoutModal session={session} onRestart={handleRestartLab} />
        {stopLabDialog}
      </div>
    );
  }

  if (session && shouldUseBuiltInEditor(session, resolvedLabId)) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <CloudEditor session={session} hideHeader={false} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} />
        <SessionTimeoutModal session={session} onRestart={handleRestartLab} />
        {stopLabDialog}
      </div>
    );
  }

  if (session && shouldUseCodeServer(session, resolvedLabId) && labToolUrl?.startsWith('http')) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <IframeTool url={labToolUrl} title="VS Code (code-server)" isJupyter={false} sessionId={session?.sessionId} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} />
        <SessionTimeoutModal session={session} onRestart={handleRestartLab} />
        {stopLabDialog}
      </div>
    );
  }

  if (isJupyterSession && labToolUrl?.startsWith('http')) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <JupyterEmbed url={labToolUrl} sessionId={session?.sessionId} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} />
        <SessionTimeoutModal session={session} onRestart={handleRestartLab} />
        {stopLabDialog}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c0c0c] text-white">
      <p>Lab environment ready, but no suitable IDE found.</p>
      <button onClick={() => navigate({ to: '/student/my-labs' })} className="mt-4 bg-red-600 px-4 py-2 rounded">Back to Dashboard</button>
    </div>
  );
};
