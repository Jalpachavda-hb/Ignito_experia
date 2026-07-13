import { create } from 'zustand';
import { fetchUserActiveSession, startLabSession, stopLabSession, waitForLabSessionReady, LabSession } from '../services/labService';

interface LabSessionStore {
  activeSession: LabSession | null;
  startingLabId: string | null;
  stoppingLabId: string | null;
  elapsedTime: string | null;
  startError: string | null;
  stopError: string | null;
  
  // Actions
  loadActiveSession: (userId: string) => Promise<void>;
  startLab: (labId: string, dotnetSubtype?: string) => Promise<LabSession | null>;
  stopLab: (sessionId: string, labId: string) => Promise<void>;
  setElapsedTime: (time: string | null) => void;
  clearSession: () => void;
  clearStartError: () => void;
  setActiveSession: (session: LabSession | null) => void;
}

// Global timer interval reference
let timerInterval: ReturnType<typeof setInterval> | null = null;

const startCountdownTimer = (get: any, set: any) => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  const tick = () => {
    const currentSession = get().activeSession;
    if (currentSession && currentSession.status === 'running') {
      let isExpired = false;
      let displayStr = '0:00';
      
      if (currentSession.expiresAt) {
        const expiresMs = new Date(currentSession.expiresAt).getTime();
        const remainingMs = expiresMs - Date.now();
        if (remainingMs <= 0) {
          isExpired = true;
        } else {
          const remainingSecs = Math.floor(remainingMs / 1000);
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          displayStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      } else if (currentSession.startedAt && currentSession.durationMinutes) {
        const expiresMs = new Date(currentSession.startedAt).getTime() + currentSession.durationMinutes * 60 * 1000;
        const remainingMs = expiresMs - Date.now();
        if (remainingMs <= 0) {
          isExpired = true;
        } else {
          const remainingSecs = Math.floor(remainingMs / 1000);
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          displayStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      } else if (currentSession.startedAt) {
        // Fallback to elapsed time if no expiration data is available
        const diff = Math.floor((new Date().getTime() - new Date(currentSession.startedAt).getTime()) / 1000);
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        displayStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      if (isExpired) {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        set({ elapsedTime: 'Expired' });
        get().stopLab(currentSession.sessionId, currentSession.labId).catch((err: any) => {
          console.error("Failed to auto-stop lab on expiry:", err);
        });
      } else {
        set({ elapsedTime: displayStr });
      }
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  };

  // Run the first tick immediately, then every 1 second
  tick();
  timerInterval = setInterval(tick, 1000);
};

export const useLabSessionStore = create<LabSessionStore>((set, get) => ({
  activeSession: null,
  startingLabId: null,
  stoppingLabId: null,
  elapsedTime: null,
  startError: null,
  stopError: null,

  loadActiveSession: async (userId: string) => {
    try {
      const response = await fetchUserActiveSession(userId);
      const session = response.session;
      
      set({ activeSession: session || null });
      get().setElapsedTime(null);
      
      if (session && session.status === 'running') {
        startCountdownTimer(get, set);
      } else {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
      }
    } catch (err) {
      console.error('Failed to load active session:', err);
    }
  },

  startLab: async (labId: string, dotnetSubtype?: string) => {
    set({ startingLabId: labId, startError: null });
    try {
      const startResponse = await startLabSession({ labId, dotnetSubtype });
      if (!startResponse.sessionId) throw new Error('No session id returned from server');

      const readySession = await waitForLabSessionReady(startResponse.sessionId);
      set({ activeSession: readySession, startingLabId: null });
      
      if (readySession && readySession.status === 'running') {
        startCountdownTimer(get, set);
      }
      
      return readySession;
    } catch (err: any) {
      set({ startingLabId: null, startError: err?.message || 'Failed to start lab' });
      return null;
    }
  },

  stopLab: async (sessionId: string, labId: string) => {
    set({ stoppingLabId: labId, stopError: null });
    try {
      await stopLabSession(sessionId);
      set({ activeSession: null, elapsedTime: null, stoppingLabId: null });
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    } catch (err: any) {
      set({ stoppingLabId: null, stopError: err?.message || 'Failed to stop lab' });
      throw err;
    }
  },

  setElapsedTime: (time: string | null) => set({ elapsedTime: time }),
  
  clearSession: () => {
    set({ activeSession: null, elapsedTime: null, startError: null, stopError: null, startingLabId: null, stoppingLabId: null });
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  },

  clearStartError: () => set({ startError: null }),

  setActiveSession: (session: LabSession | null) => {
    set({ activeSession: session });
    if (session && session.status === 'running') {
      startCountdownTimer(get, set);
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  }
}));
