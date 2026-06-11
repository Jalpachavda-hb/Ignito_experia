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
  startLab: (labId: string) => Promise<LabSession | null>;
  stopLab: (sessionId: string, labId: string) => Promise<void>;
  setElapsedTime: (time: string | null) => void;
  clearSession: () => void;
  clearStartError: () => void;
}

// Global timer interval reference
let timerInterval: ReturnType<typeof setInterval> | null = null;

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
      get().setElapsedTime(null); // Will be recalculated by the component or timer
      
      // Start or stop global timer based on session
      if (session && session.status === 'running' && session.startedAt) {
        if (!timerInterval) {
          timerInterval = setInterval(() => {
            const currentSession = get().activeSession;
            if (currentSession && currentSession.status === 'running' && currentSession.startedAt) {
              const diff = Math.floor((new Date().getTime() - new Date(currentSession.startedAt).getTime()) / 1000);
              const mins = Math.floor(diff / 60);
              const secs = diff % 60;
              set({ elapsedTime: `${mins}:${secs.toString().padStart(2, '0')}` });
            }
          }, 1000);
        }
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

  startLab: async (labId: string) => {
    set({ startingLabId: labId, startError: null });
    try {
      const startResponse = await startLabSession({ labId });
      if (!startResponse.sessionId) throw new Error('No session id returned from server');

      const readySession = await waitForLabSessionReady(startResponse.sessionId);
      set({ activeSession: readySession, startingLabId: null });
      
      // Setup timer
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        const currentSession = get().activeSession;
        if (currentSession && currentSession.status === 'running' && currentSession.startedAt) {
          const diff = Math.floor((new Date().getTime() - new Date(currentSession.startedAt).getTime()) / 1000);
          const mins = Math.floor(diff / 60);
          const secs = diff % 60;
          set({ elapsedTime: `${mins}:${secs.toString().padStart(2, '0')}` });
        }
      }, 1000);
      
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

  clearStartError: () => set({ startError: null })
}));
