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
  sendLabStartMetrics,
  rememberLabSession,
  recallLabSession,
  forgetLabSession,
  LabStartTimer,
  START_STAGE_LABELS,
  type LabStartStage,
  type LabSession,
} from '@/services/labService';
import { useLabHeartbeat } from '@/hooks/use-lab-heartbeat';
import { resolveApiRelativeUrl } from '@/config/env';
import CloudEditor from './Editor';
import Terminal from './Terminal';
import { SessionTimeoutModal } from '../student/my-labs/components/session-timeout-modal';
import { ArrowLeft, Power, Clock } from 'lucide-react';
import AndroidEmulator from './AndroidEmulator';

const resolveToolUrl = (url: string | null | undefined) => resolveApiRelativeUrl(url);

const normalizeRuntimeType = (value?: string | null) => {
  const rt = (value || '').toLowerCase().trim();
  if (!rt) return '';
  if (rt === 'ide' || rt.includes('custom ide') || rt === 'testing' || rt.includes('testing')) return 'ide';
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

  // Use only URLs the backend returns; never build lab URLs from the task IP in the browser.
  if (session.tools?.main?.url) return resolveToolUrl(session.tools.main.url);
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
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIframeSrc('');
    setNeedsReconnect(false);

    const run = async () => {
      if (sessionId) {
        for (let i = 0; i < 45; i++) {
          if (cancelled) return;
          try {
            const health = await fetchJupyterHealth(sessionId);
            // Jupyter rejected the session secret: show Reconnect instead of a Jupyter login page.
            if ((health as { status?: string }).status === 'auth_required') {
              if (!cancelled) {
                setNeedsReconnect(true);
                setIsLoading(false);
              }
              return;
            }
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
  }, [url, sessionId, reconnectKey]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
      <div className="bg-[#1e1e1e] border-b border-white/10 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-white text-sm font-black uppercase tracking-wide">Data Science Lab</span>
          {remainingTime && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/60 text-white font-mono text-xs font-bold shrink-0 shadow-sm">
              <Clock size={14} className="text-white shrink-0" />
              <span className="text-white font-bold tracking-wider text-[11px]">TIME REMAINING:</span>
              <span className="text-white font-extrabold tracking-wider bg-red-600 px-2 py-0.5 rounded border border-red-400/50 text-xs">
                {remainingTime}
              </span>
            </div>
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
        {needsReconnect && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#1e1e1e] px-6 text-center">
            <span className="text-white text-sm font-bold">The notebook could not confirm this session.</span>
            <span className="text-white/70 text-xs max-w-md">
              Reconnect to try again. If it keeps happening, stop the lab and start it again.
            </span>
            <button
              onClick={() => setReconnectKey((k) => k + 1)}
              className="h-8 px-5 rounded bg-[#f97316] text-white text-xs font-black uppercase tracking-widest"
            >
              Reconnect
            </button>
          </div>
        )}
        {iframeSrc && !needsReconnect && (
          <iframe src={iframeSrc} title="JupyterLab" className="absolute inset-0 h-full w-full border-0" allow="clipboard-read; clipboard-write; fullscreen" onLoad={() => setIsLoading(false)} />
        )}
      </div>
    </div>
  );
};

const STAGE_ORDER: LabStartStage[] = ['QUEUED', 'PROVISIONING', 'PULLING', 'STARTING', 'READY'];

const formatSeconds = (total: number) => {
  const m = Math.floor(total / 60);
  const sec = Math.max(0, total % 60);
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
};

const ENDED_STATUSES = ['stopped', 'expired', 'completed', 'failed', 'stopping'];

export const RemoteDesktop = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [connecting, setConnecting] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [labRuntimeType, setLabRuntimeType] = useState('');
  const [error, setError] = useState('');
  const [stage, setStage] = useState<LabStartStage | null>(null);
  const [expectedSeconds, setExpectedSeconds] = useState<number | null>(null);
  const [isWarmStart, setIsWarmStart] = useState(false);
  const [startedAtMs, setStartedAtMs] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const initStartedRef = useRef(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const user = useAuthStore(state => state.auth.user);
  const { stopLab, elapsedTime: remainingTime, setActiveSession } = useLabSessionStore();

  const search = location.search as Record<string, string>;
  const labId = search.labId || '';
  const sessionIdParam = search.sessionId || '';

  useEffect(() => {
    const signal = { cancelled: false };
    const initializeSession = async () => {
      if (!labId || initStartedRef.current) return;
      if (!sessionIdParam && !user?.userId) return; // Need user ID to fetch or start session

      initStartedRef.current = true;
      const timer = new LabStartTimer();
      setStartedAtMs(Date.now());
      setStage('QUEUED');

      try {
        let catalogRuntimeType = '';
        try {
          const labDetails = await fetchLabDetails(labId);
          catalogRuntimeType = labDetails?.runtime?.type || labDetails?.lab?.runtime?.type || '';
          setLabRuntimeType(catalogRuntimeType);
        } catch {
          // Lab catalog is optional for session init; session runtime is fallback.
        }

        // Reconnect, don't restart: URL param, then this tab's remembered session, then the
        // student's active session. Only start a new one when none of those is still alive.
        let activeSession: (LabSession & { reused?: boolean }) | null = null;
        let isFreshStart = false;
        const candidateId = sessionIdParam || recallLabSession(labId);
        if (candidateId) {
          try {
            const existing = await fetchLabSessionStatus(candidateId);
            if (existing?.sessionId && !ENDED_STATUSES.includes(String(existing.status).toLowerCase())) {
              activeSession = existing;
            } else {
              forgetLabSession(labId);
            }
          } catch {
            forgetLabSession(labId);
          }
        }
        if (!activeSession && user?.userId) {
          const activeRes = await fetchUserActiveSession(String(user.userId), labId);
          if (activeRes.session && activeRes.session.labId === labId) {
            activeSession = activeRes.session;
          } else {
            // Backend returns the existing session (reused: true) if one is already running.
            activeSession = await startLabSession({ labId });
            isFreshStart = !activeSession?.reused;
          }
        }
        if (!activeSession?.sessionId) throw new Error('No lab session available');
        rememberLabSession(labId, activeSession.sessionId);

        setIsWarmStart(Boolean(activeSession.warm));
        if (activeSession.expectedReadySeconds) setExpectedSeconds(activeSession.expectedReadySeconds);
        if (activeSession.stage) {
          setStage(activeSession.stage);
          timer.observe(activeSession.stage);
        }

        const isAndroid = labId === 'mobile-app-lab' || labId === 'android';
        const readySession = await waitForLabSessionReady(activeSession.sessionId, {
          maxAttempts: isAndroid ? 300 : 150,
          intervalMs: 2000,
          signal,
          onProgress: (progress) => {
            if (progress.stage) {
              setStage(progress.stage);
              timer.observe(progress.stage);
            }
            if (progress.expectedReadySeconds) setExpectedSeconds(progress.expectedReadySeconds);
            if (typeof progress.warm === 'boolean') setIsWarmStart(progress.warm);
          },
        });
        if (signal.cancelled) return;

        if (isFreshStart) {
          sendLabStartMetrics(readySession.sessionId, timer.finish()).catch(() => {
            /* analytics are best effort */
          });
        }

        const sessionWithRuntime = {
          ...readySession,
          runtimeType: getEffectiveRuntimeType(readySession, catalogRuntimeType),
        };
        setSession(sessionWithRuntime);
        setActiveSession(sessionWithRuntime);
        setConnecting(false);
      } catch (err: any) {
        if (signal.cancelled) return;
        setError(err.message || 'Failed to initialize session');
        setStage('FAILED');
        initStartedRef.current = false;
      }
    };
    initializeSession();
    return () => {
      signal.cancelled = true;
      initStartedRef.current = false;
    };
  }, [location.search, user?.userId, sessionIdParam, retryKey]);

  // Elapsed time on the start screen.
  useEffect(() => {
    if (!connecting || error) return;
    const handle = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAtMs) / 1000)), 1000);
    return () => clearInterval(handle);
  }, [connecting, error, startedAtMs]);

  const { idleWarning, dismissIdleWarning } = useLabHeartbeat(
    connecting ? null : session?.sessionId,
    session?.idleTimeoutMinutes ?? null
  );

  const handleRetry = () => {
    setError('');
    setStage(null);
    setElapsedSeconds(0);
    setRetryKey((k) => k + 1);
  };

  const handleStopLab = async () => {
    setIsStopping(true);
    try {
      if (session?.sessionId) {
        await stopLab(session.sessionId, session.labId);
        forgetLabSession(labId);
        localStorage.removeItem(`lastGrade_${session.sessionId}`);
        const labKey = session.labId || '';
        Object.keys(localStorage).forEach(key => {
          if (
            key.includes(`vlab_backup_${labKey}`) ||
            key.includes(`vlab_saved_${labKey}`) ||
            key.includes(`vlab_files_${labKey}`)
          ) {
            localStorage.removeItem(key);
          }
        });
      }
      setSession(null);
      setActiveSession(null);
      navigate({ to: '/student/my-labs' });
    } catch (err) {
      setSession(null);
      setActiveSession(null);
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
      setSession(null);
      setActiveSession(null);
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

  const idleBanner = idleWarning !== null && (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-lg">
      <span>
        {idleWarning <= 0
          ? 'This lab is about to stop because it looks idle.'
          : `This lab will stop in about ${idleWarning} min because it looks idle.`}
      </span>
      <button onClick={dismissIdleWarning} className="rounded bg-black/80 px-3 py-1 text-xs font-bold text-white">
        I'm still here
      </button>
    </div>
  );

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
    const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : -1;
    const showLongProgress = !isWarmStart;
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c0c0c] text-white px-6 text-center">
        {!error && <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />}
        <p className="text-lg font-bold tracking-widest uppercase text-slate-300">
          {error ? 'Unable to Start Lab' : isWarmStart ? 'Connecting to your lab' : (stage && START_STAGE_LABELS[stage]) || 'Initializing Workspace'}
        </p>
        {!error && showLongProgress && (
          <>
            <ol className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
              {STAGE_ORDER.slice(1).map((s, i) => {
                const idx = i + 1;
                const state = idx < currentIndex ? 'done' : idx === currentIndex ? 'active' : 'todo';
                return (
                  <li
                    key={s}
                    className={
                      state === 'done'
                        ? 'rounded px-2 py-1 bg-emerald-600/30 text-emerald-300'
                        : state === 'active'
                          ? 'rounded px-2 py-1 bg-red-600/40 text-white'
                          : 'rounded px-2 py-1 bg-white/5 text-slate-500'
                    }
                  >
                    {state === 'done' ? '✓ ' : ''}{START_STAGE_LABELS[s]}
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-slate-400 mt-4">
              {formatSeconds(elapsedSeconds)} elapsed
              {expectedSeconds ? ` · usually ready in about ${formatSeconds(expectedSeconds)}` : ''}
            </p>
            {expectedSeconds && elapsedSeconds > expectedSeconds * 1.5 && (
              <p className="text-xs text-slate-500 mt-1">Taking longer than usual. Keep this tab open.</p>
            )}
          </>
        )}
        {error && (
          <div className="mt-4 flex flex-col items-center gap-4">
            <p className="text-red-400 max-w-md text-sm">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-md transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => navigate({ to: '/student/my-labs' })}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors"
              >
                Back to My Labs
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (session && isTerminalSession) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <Terminal session={session} hideHeader={false} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
        {stopLabDialog}
        {idleBanner}
      </div>
    );
  }

  if (session && isBuiltInEditorSession) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#f4f6f8]">
        <CloudEditor session={session} hideHeader={false} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
        {stopLabDialog}
        {idleBanner}
      </div>
    );
  }

  if (session && isEmulatorSession) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <AndroidEmulator session={session} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
        {stopLabDialog}
        {idleBanner}
      </div>
    );
  }


  if (isJupyterSession && typeof labToolUrl === 'string' && labToolUrl.startsWith('http')) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0c0c0c]">
        <JupyterEmbed url={labToolUrl} sessionId={session?.sessionId} onStopLab={() => setShowStopModal(true)} onBack={() => navigate({ to: '/student/my-labs' })} remainingTime={remainingTime} />
        <SessionTimeoutModal session={session} />
        {stopLabDialog}
        {idleBanner}
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
