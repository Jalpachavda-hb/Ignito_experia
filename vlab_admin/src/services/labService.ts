import {
  fetchLabs,
  fetchSubLabs,
  fetchLabDetails,
  fetchLabSessionStatus,
  fetchJupyterHealth,
  fetchUserActiveSession,
} from '../Utils/GetApiHandler';
import {
  startLabSession,
  extendLabSession,
  stopLabSession,
  updateLabCredits,
  sendLabHeartbeat,
  sendLabStartMetrics,
} from '../Utils/PostApiHandler';

export type LabStatus = 'pending' | 'starting' | 'running' | 'expiring_soon' | 'failed' | 'stopped' | 'completed' | 'expired';

/** Start stage reported by the backend (docs/lab-startup-optimization.md §3.2). */
export type LabStartStage = 'QUEUED' | 'PROVISIONING' | 'PULLING' | 'STARTING' | 'READY' | 'FAILED';

export interface LabSession {
  sessionId: string;
  labId: string;
  userId?: string;
  status: LabStatus;
  message?: string;
  publicIp?: string;
  tools?: {
    main?: { type: string; url: string; enabled?: boolean };
    jupyter?: { type: string; url: string; enabled?: boolean };
    /** noVNC "Browser desktop" (testing lab). URL includes the session's VNC password: keep it in memory only. */
    desktop?: { type: string; url: string | null; enabled?: boolean };
  };
  startedAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
  allocatedCredits?: number;
  allocatedDurationMinutes?: number;
  tenMinuteWarningSent?: boolean;
  durationMinutes?: number;
  dotnetSubtype?: string;
  stage?: LabStartStage | null;
  warm?: boolean;
  expectedReadySeconds?: number;
  reused?: boolean;
  idleTimeoutMinutes?: number | null;
}

export interface LabLaunchResponse {
  sessionId: string;
  status: LabStatus;
  message?: string;
}

export interface JupyterStatus {
  status: 'ok' | 'error' | 'auth_required';
  message?: string;
}

export {
  fetchLabs,
  fetchSubLabs,
  fetchLabDetails,
  startLabSession,
  extendLabSession,
  fetchLabSessionStatus,
  fetchJupyterHealth,
  fetchUserActiveSession,
  stopLabSession,
  updateLabCredits,
  sendLabHeartbeat,
  sendLabStartMetrics,
};

export const START_STAGE_LABELS: Record<LabStartStage, string> = {
  QUEUED: 'Requesting a machine',
  PROVISIONING: 'Starting machine',
  PULLING: 'Downloading tools',
  STARTING: 'Starting services',
  READY: 'Ready',
  FAILED: 'Failed to start',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves when the tab is visible (polling pauses while the student is on another tab). */
const waitUntilVisible = () =>
  new Promise<void>((resolve) => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      resolve();
      return;
    }
    const onChange = () => {
      if (document.visibilityState !== 'hidden') {
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', onChange);
  });

const isSessionReady = (session: LabSession) => {
  const toolUrl = session.tools?.jupyter?.url || session.tools?.main?.url || null;
  const isJupyter = session.tools?.main?.type === 'jupyter' || session.tools?.jupyter?.enabled;
  return (
    session.status === 'running' &&
    (session.publicIp || (toolUrl && toolUrl.startsWith('http')) || (isJupyter && toolUrl?.includes('/jupyter')))
  );
};

/**
 * Poll until the lab is ready. Polls every `intervalMs` (2 s) while starting, pauses while the tab
 * is hidden, and reports each status to `onProgress` so the UI can show the real stage.
 * `maxWaitMs` bounds visible waiting time (time spent in a hidden tab doesn't count).
 */
export async function waitForLabSessionReady(
  sessionId: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onProgress?: (session: LabSession) => void;
    signal?: { cancelled: boolean };
  } = {}
): Promise<LabSession> {
  const { maxAttempts = 300, intervalMs = 2000, onProgress, signal } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await waitUntilVisible();
    if (signal?.cancelled) throw new Error('cancelled');

    const session: LabSession = await fetchLabSessionStatus(sessionId);
    onProgress?.(session);

    if (session.status === 'failed' || session.stage === 'FAILED') {
      throw new Error(session.message || 'Lab environment failed to start');
    }
    if (['stopped', 'expired', 'completed'].includes(String(session.status))) {
      throw new Error('This lab session has ended. Start the lab again.');
    }
    if (isSessionReady(session)) {
      return session;
    }

    await sleep(intervalMs);
  }

  throw new Error('Lab environment timed out while starting. Please try again.');
}

/**
 * Tracks how long each start stage took, for the start-metrics call
 * (labType, warm, clickToReadyMs, stageDurations).
 */
export class LabStartTimer {
  private readonly clickedAt: number;
  private currentStage: LabStartStage | null = null;
  private stageStartedAt = 0;
  readonly stageDurations: Partial<Record<LabStartStage, number>> = {};

  constructor(clickedAt = Date.now()) {
    this.clickedAt = clickedAt;
  }

  observe(stage?: LabStartStage | null) {
    if (!stage || stage === this.currentStage) return;
    const now = Date.now();
    if (this.currentStage) {
      this.stageDurations[this.currentStage] = (this.stageDurations[this.currentStage] || 0) + (now - this.stageStartedAt);
    }
    this.currentStage = stage;
    this.stageStartedAt = now;
  }

  finish() {
    this.observe('READY');
    return { clickToReadyMs: Date.now() - this.clickedAt, stageDurations: this.stageDurations };
  }
}

// "Reconnect, don't restart": remember the running session per lab for this tab only.
// sessionStorage (not localStorage) and only the id: never tool URLs or tokens.
const sessionKey = (labId: string) => `vlab.session.${labId}`;

export const rememberLabSession = (labId: string, sessionId: string) => {
  try {
    sessionStorage.setItem(sessionKey(labId), sessionId);
  } catch {
    /* storage unavailable */
  }
};

export const recallLabSession = (labId: string): string | null => {
  try {
    return sessionStorage.getItem(sessionKey(labId));
  } catch {
    return null;
  }
};

export const forgetLabSession = (labId: string) => {
  try {
    sessionStorage.removeItem(sessionKey(labId));
  } catch {
    /* storage unavailable */
  }
};
