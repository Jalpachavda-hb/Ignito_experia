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
  fetchLabDetails,
} from '@/services/labService';
import { resolveApiRelativeUrl } from '@/config/env';
import CloudEditor from './Editor';
import Terminal from './Terminal';
import { SessionTimeoutModal } from '../student/my-labs/components/session-timeout-modal';
import { ArrowLeft, Power } from 'lucide-react';
import AndroidEmulator from './AndroidEmulator';

const resolveToolUrl = (url: string | null | undefined) => resolveApiRelativeUrl(url);

const normalizeRuntimeType = (value?: string | null) => {
  const rt = (value || '').toLowerCase().trim();
  if (!rt) return '';
  if (rt === 'ide' || rt.includes('custom ide')) return 'ide';
  if (rt === 'jupyter' || rt === 'datascience') return 'jupyter';
  if (rt === 'terminal') return 'terminal';
  if (rt === 'emulator' || rt === 'android emulator' || rt.includes('emulator')) return 'emulator';
  return rt;
};

const getEffectiveRuntimeType = (session: any, labRuntimeType?: string) => {
  const fromCatalog = normalizeRuntimeType(labRuntimeType);
  if (fromCatalog) return fromCatalog;
  return normalizeRuntimeType(session?.runtimeType || session?.tools?.main?.type);
};

const getLabToolUrl = (session: any, effectiveRuntimeType?: string) => {
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





interface EmbedProps {
  url: string;
  sessionId?: string;
  onStopLab: () => void;
  onBack: () => void;
  remainingTime?: string | null;
}

const JupyterEmbed = ({ url, sessionId, onStopLab, onBack, remainingTime }: EmbedProps) => {
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
            // Check both backend ready indicator and standard HTTP status code
            if (health.status === 'ok') {
              // Wait an additional 2 seconds after health passes to ensure proxy is fully bound
              await new Promise((r) => setTimeout(r, 2000));
              break;
            }
          } catch { }
          await new Promise((r) => setTimeout(r, 1500));
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
        <div className="flex items-center gap-4">
          <span className="text-white text-sm font-black uppercase tracking-wide">Data Science Lab</span>
          {remainingTime && (
            <span className="text-red-500 font-mono text-xs font-black bg-red-950/40 border border-red-500/20 px-2 py-0.5 rounded animate-pulse">
              Time Remaining: {remainingTime}
            </span>
          )}
        </div>
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

export const RemoteDesktop = () => {
    console.log("RemoteDesktop rendered");
  const navigate = useNavigate();
  const location = useLocation();
  const [connecting, setConnecting] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [labRuntimeType, setLabRuntimeType] = useState('');
  const [error, setError] = useState('');
  const initStartedRef = useRef(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const user = useAuthStore(state => state.auth.user);
  const { stopLab, elapsedTime: remainingTime, setActiveSession } = useLabSessionStore();

  const search = location.search as Record<string, string>;
  const labId = search.labId || '';
  const sessionIdParam = search.sessionId || '';

  useEffect(() => {
    const initializeSession = async () => {
      if (!labId || initStartedRef.current) return;
      if (!sessionIdParam && !user?.userId) return; // Need user ID to fetch or start session

      initStartedRef.current = true;

      try {
        let catalogRuntimeType = '';
        try {
          const labDetails = await fetchLabDetails(labId);
          catalogRuntimeType = labDetails?.runtime?.type || labDetails?.lab?.runtime?.type || '';
          setLabRuntimeType(catalogRuntimeType);
        } catch {
          // Lab catalog is optional for session init; session runtime is fallback.
        }

        let activeSession = null;
        if (sessionIdParam) {
          activeSession = await fetchLabSessionStatus(sessionIdParam);
        } else if (user?.userId) {
          const activeRes = await fetchUserActiveSession(String(user.userId), labId);
          if (activeRes.session && activeRes.session.labId === labId) {
            activeSession = activeRes.session;
          } else {
            activeSession = await startLabSession({ labId });
          }
        }
        if (!activeSession?.sessionId) throw new Error('No lab session available');
        const isAndroid = labId === 'mobile-app-lab' || labId === 'android';
        const readySession = await waitForLabSessionReady(activeSession.sessionId, {
          maxAttempts: isAndroid ? 300 : 90,
          intervalMs: 2000
        });
        const sessionWithRuntime = {
          ...readySession,
          runtimeType: getEffectiveRuntimeType(readySession, catalogRuntimeType),
        };
        setSession(sessionWithRuntime);
        setActiveSession(sessionWithRuntime);
        setConnecting(false);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize session');
        initStartedRef.current = false;
      }
    };
    initializeSession();
  }, [location.search, user?.userId, sessionIdParam]);

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

  const effectiveRuntimeType = getEffectiveRuntimeType(session, labRuntimeType);
  const labToolUrl = getLabToolUrl(session, effectiveRuntimeType);
  const rt = effectiveRuntimeType;
  const isJupyterSession = rt === 'jupyter';
  const isTerminalSession = rt === 'terminal';
  const isBuiltInEditorSession = rt === 'ide';
  const isEmulatorSession = rt === 'emulator';

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
    const isAndroid = labId === 'mobile-app-lab' || labId === 'android';
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c0c0c] text-white px-6 text-center">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-bold tracking-widest uppercase text-slate-300">Initializing Workspace</p>
        {isAndroid && (
          <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
            Note: The first launch of the Mobile Application Development Lab can take 3–8 minutes as the large Android SDK & Gradle runtime container image is downloaded. Please keep this tab open.
          </p>
        )}
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    );
  }



  if (session && isTerminalSession) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <Terminal session={session} hideHeader={false} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
        {stopLabDialog}
      </div>
    );
  }

  if (session && isBuiltInEditorSession) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <CloudEditor session={session} hideHeader={false} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
        {stopLabDialog}
      </div>
    );
  }

  if (session && isEmulatorSession) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <AndroidEmulator session={session} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
        {stopLabDialog}
      </div>
    );
  }


  if (isJupyterSession && typeof labToolUrl === 'string' && labToolUrl.startsWith('http')) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <JupyterEmbed url={labToolUrl} sessionId={session?.sessionId} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
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
