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
} from '../Utils/PostApiHandler';

export type LabStatus = 'pending' | 'starting' | 'running' | 'expiring_soon' | 'failed' | 'stopped' | 'completed' | 'expired';

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
  };
  startedAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
  allocatedCredits?: number;
  allocatedDurationMinutes?: number;
  tenMinuteWarningSent?: boolean;
  durationMinutes?: number;
}

export interface LabLaunchResponse {
  sessionId: string;
  status: LabStatus;
  message?: string;
}

export interface JupyterStatus {
  status: 'ok' | 'error';
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
};

/** Poll until ECS task is running and container URL (public IP) is available. */
export async function waitForLabSessionReady(
  sessionId: string,
  options: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<LabSession> {
  const { maxAttempts = 300, intervalMs = 2000 } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const session = await fetchLabSessionStatus(sessionId);

    if (session.status === 'failed') {
      throw new Error(session.message || 'Lab environment failed to start');
    }

    const toolUrl = session.tools?.jupyter?.url || session.tools?.main?.url || null;
    const isJupyter = session.tools?.main?.type === 'jupyter' || session.tools?.jupyter?.enabled;

    const ready =
      session.status === 'running' &&
      (session.publicIp || (toolUrl && toolUrl.startsWith('http')) || (isJupyter && toolUrl?.includes('/jupyter')));

    if (ready) {
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Lab environment timed out while starting. Please try again.');
}

