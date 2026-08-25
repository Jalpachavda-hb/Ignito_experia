import { create } from 'zustand';
import { fetchUserActiveSession, startLabSession, extendLabSession, stopLabSession, fetchLabSessionStatus, waitForLabSessionReady, LabSession } from '../services/labService';
import { saveLabActivity, markLabCompleted } from '../Utils/labActivityTracker';
import { useAuthStore } from './auth-store';
import { useLabStore } from './labStore';
import { useTransactionStore } from './transactionStore';
import { useLabCreditUsageStore } from './labCreditUsageStore';

interface LabSessionStore {
  activeSession: LabSession | null;
  startingLabId: string | null;
  stoppingLabId: string | null;
  extendingSessionId: string | null;
  elapsedTime: string | null;
  remainingSeconds: number | null;
  showWarningModal: boolean;
  warningAcknowledged: boolean;
  showExtensionModal: boolean;
  showExpiredModal: boolean;
  startError: string | null;
  stopError: string | null;
  extendError: string | null;

  // Actions
  loadActiveSession: (userId?: string) => Promise<void>;
  startLab: (labId: string, sessionBlocks?: number, dotnetSubtype?: string, academicCtx?: any, userCredits?: number) => Promise<LabSession | null>;
  extendLab: (sessionBlocks?: number) => Promise<boolean>;
  stopLab: (sessionId: string, labId: string) => Promise<void>;
  setElapsedTime: (time: string | null) => void;
  setShowWarningModal: (show: boolean) => void;
  setWarningAcknowledged: (ack: boolean) => void;
  setShowExtensionModal: (show: boolean) => void;
  setShowExpiredModal: (show: boolean) => void;
  clearSession: () => void;
  clearStartError: () => void;
  setActiveSession: (session: LabSession | null) => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;

const startCountdownTimer = (get: any, set: any) => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  const tick = () => {
    const currentSession = get().activeSession;
    if (currentSession && ['running', 'starting', 'expiring_soon', 'RUNNING', 'STARTING', 'EXPIRING_SOON'].includes(currentSession.status)) {
      let isExpired = false;
      let displayStr = '0:00';
      let secsRemaining = 0;

      if (currentSession.expiresAt) {
        const expiresMs = new Date(currentSession.expiresAt).getTime();
        const remainingMs = expiresMs - Date.now();
        if (remainingMs <= 0) {
          isExpired = true;
        } else {
          secsRemaining = Math.floor(remainingMs / 1000);
          const mins = Math.floor(secsRemaining / 60);
          const secs = secsRemaining % 60;
          displayStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      }

      if (isExpired) {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
        set({ elapsedTime: 'Expired', remainingSeconds: 0, showExpiredModal: true, showWarningModal: false });
      } else {
        set({ elapsedTime: displayStr, remainingSeconds: secsRemaining });

        // Trigger 10-minute warning modal when 10 minutes (600s) remain and warning not yet acknowledged
        if (secsRemaining <= 600 && secsRemaining > 0 && !get().warningAcknowledged && !get().showWarningModal) {
          set({ showWarningModal: true });
        }
      }
    } else {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    }
  };

  tick();
  timerInterval = setInterval(tick, 1000);

  // Periodic synchronization with backend server every 30 seconds
  syncInterval = setInterval(async () => {
    const current = get().activeSession;
    if (current?.sessionId) {
      try {
        const latest = await fetchLabSessionStatus(current.sessionId);
        if (latest && latest.expiresAt) {
          set({
            activeSession: {
              ...current,
              status: latest.status || current.status,
              expiresAt: latest.expiresAt,
              remainingSeconds: latest.remainingSeconds ?? current.remainingSeconds
            }
          });
        }
      } catch (err) {
        console.warn("[labSessionStore] Server sync warning:", err);
      }
    }
  }, 30000);
};

export const useLabSessionStore = create<LabSessionStore>((set, get) => ({
  activeSession: null,
  startingLabId: null,
  stoppingLabId: null,
  extendingSessionId: null,
  elapsedTime: null,
  remainingSeconds: null,
  showWarningModal: false,
  warningAcknowledged: false,
  showExtensionModal: false,
  showExpiredModal: false,
  startError: null,
  stopError: null,
  extendError: null,

  loadActiveSession: async (userId?: string) => {
    try {
      const authUser = useAuthStore.getState()?.auth?.user;
      const targetUserId = userId || authUser?.userId || authUser?.email || '';
      const response = await fetchUserActiveSession(targetUserId);
      const session = response.session || response.activeSession || null;

      set({ activeSession: session });
      get().setElapsedTime(null);

      if (session && ['running', 'starting', 'expiring_soon', 'RUNNING', 'STARTING', 'EXPIRING_SOON'].includes(session.status)) {
        startCountdownTimer(get, set);
        const labs = useLabStore.getState()?.labs || [];
        const matchedLab = labs.find((l: any) => (l.id || l.labId || l.LabId || l.labCode || l._id) === session.labId);
        saveLabActivity(String(targetUserId), {
          id: session.labId,
          labName: matchedLab?.title || matchedLab?.name || session.labId,
          status: 'In Progress',
          creditsUsed: session.allocatedCredits || matchedLab?.credits || 40,
          completionPercentage: 50,
          lastAccessed: session.startedAt || new Date().toISOString()
        });
      } else {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
      }
    } catch (err) {
      console.error('Failed to load active session:', err);
    }
  },

  startLab: async (labId: string, sessionBlocks: number = 1, dotnetSubtype?: string, academicCtx?: any, userCredits?: number) => {
    set({ startingLabId: labId, startError: null });
    try {
      const idempotencyKey = `START-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const startResponse = await startLabSession({ labId, sessionBlocks, dotnetSubtype, idempotencyKey, userCredits });
      if (!startResponse.sessionId) throw new Error(startResponse.message || 'No session id returned from server');

      const initialSession: LabSession = {
        sessionId: startResponse.sessionId,
        labId,
        userId: '',
        status: startResponse.status || 'starting',
        expiresAt: startResponse.expiresAt,
        startedAt: startResponse.startedAt,
        allocatedCredits: startResponse.allocatedCredits,
        allocatedDurationMinutes: startResponse.allocatedDurationMinutes
      };

      set({ activeSession: initialSession, startingLabId: null, warningAcknowledged: false, showWarningModal: false });

      const authUser = useAuthStore.getState()?.auth?.user;
      const uId = authUser?.userId || authUser?.email || '';
      const labs = useLabStore.getState()?.labs || [];
      const matchedLab = labs.find((l: any) => (l.id || l.labId || l.LabId || l.labCode || l._id) === labId);

      saveLabActivity(String(uId), {
        id: labId,
        labName: matchedLab?.title || matchedLab?.name || (dotnetSubtype ? `.NET ${dotnetSubtype.toUpperCase()} Lab` : labId),
        status: 'In Progress',
        creditsUsed: startResponse.allocatedCredits || matchedLab?.credits || 40,
        completionPercentage: 50,
        lastAccessed: new Date().toISOString()
      });

      startCountdownTimer(get, set);

      // Poll in background until ready
      waitForLabSessionReady(startResponse.sessionId)
        .then((readySession) => {
          set({ activeSession: { ...get().activeSession, ...readySession } });
        })
        .catch((err) => {
          console.warn('Background lab session readiness check warning:', err?.message);
        });

      return initialSession;
    } catch (err: any) {
      set({ startingLabId: null, startError: err?.message || 'Failed to start lab' });
      return null;
    }
  },

  extendLab: async (sessionBlocks: number = 1) => {
    const currentSession = get().activeSession;
    if (!currentSession?.sessionId) return false;
    set({ extendingSessionId: currentSession.sessionId, extendError: null });

    try {
      const idempotencyKey = `EXTEND-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await extendLabSession(currentSession.sessionId, { sessionBlocks, idempotencyKey });
      if (res && res.expiresAt) {
        set({
          activeSession: {
            ...currentSession,
            expiresAt: res.expiresAt,
            allocatedCredits: res.allocatedCredits || currentSession.allocatedCredits,
            allocatedDurationMinutes: res.allocatedDurationMinutes || currentSession.allocatedDurationMinutes,
            status: 'running'
          },
          extendingSessionId: null,
          showExtensionModal: false,
          showWarningModal: false,
          warningAcknowledged: true
        });
        startCountdownTimer(get, set);
        return true;
      }
      throw new Error(res?.message || 'Extension failed');
    } catch (err: any) {
      set({ extendingSessionId: null, extendError: err?.message || 'Failed to extend lab session' });
      return false;
    }
  },

  stopLab: async (sessionId: string, labId: string) => {
    set({ stoppingLabId: labId, stopError: null });
    try {
      const session = useLabSessionStore.getState().activeSession;
      let calculatedMinutes = 1;
      if (session?.startedAt) {
        const startMs = new Date(session.startedAt).getTime();
        calculatedMinutes = Math.max(1, Math.ceil((Date.now() - startMs) / 60000));
      }

      const stopRes = await stopLabSession(sessionId);
      const authUser = useAuthStore.getState()?.auth?.user;
      const uId = (authUser?.email || authUser?.userId || '').toString().trim().toLowerCase();

      const actualMinutes = Number(stopRes?.actualMinutesUsed ?? calculatedMinutes);
      // 1 minute = 1 token/credit cut
      const creditsConsumed = Number(stopRes?.finalCreditsConsumed ?? stopRes?.creditsConsumed ?? actualMinutes);

      const labs = useLabStore.getState()?.labs || [];
      const matchedLab = labs.find((l: any) => (l.id || l.labId || l.LabId || l.labCode || l._id) === labId);
      let labName = matchedLab?.title || matchedLab?.name;
      if (!labName) {
        const lowerId = String(labId).toLowerCase();
        if (lowerId.includes('linux')) labName = 'Linux Administration Lab';
        else if (lowerId.includes('python')) labName = 'Python Programming Lab';
        else if (lowerId.includes('java')) labName = 'Java Development Lab';
        else if (lowerId.includes('android')) labName = 'Android Application Lab';
        else if (lowerId.includes('dotnet')) labName = '.NET Technologies Lab';
        else labName = 'Virtual Lab';
      }

      markLabCompleted(uId, labId);
      saveLabActivity(uId, {
        id: labId,
        labName,
        status: 'Completed',
        creditsUsed: creditsConsumed,
        completionPercentage: 100,
        lastAccessed: new Date().toISOString()
      });

      // Record consumed practice credits into dedicated labCreditUsageStore
      if (creditsConsumed > 0) {
        useLabCreditUsageStore.getState().addUsageRecord({
          sessionId,
          labId,
          labName,
          creditsConsumed,
          minutesUsed: actualMinutes,
          studentEmail: authUser?.email || '',
          studentName: authUser?.fullName || authUser?.name || 'Student User',
          status: 'Completed',
        });
      }

      if (typeof stopRes?.newWalletBalance === 'number') {
        useAuthStore.getState().auth.updateUser({ credits: stopRes.newWalletBalance });
      }

      set({
        activeSession: null,
        elapsedTime: null,
        remainingSeconds: null,
        stoppingLabId: null,
        showWarningModal: false,
        showExtensionModal: false,
        showExpiredModal: false,
        warningAcknowledged: false
      });

      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    } catch (err: any) {
      set({ stoppingLabId: null, stopError: err?.message || 'Failed to stop lab' });
      throw err;
    }
  },

  setElapsedTime: (time: string | null) => set({ elapsedTime: time }),
  setShowWarningModal: (show: boolean) => set({ showWarningModal: show }),
  setWarningAcknowledged: (ack: boolean) => set({ warningAcknowledged: ack }),
  setShowExtensionModal: (show: boolean) => set({ showExtensionModal: show }),
  setShowExpiredModal: (show: boolean) => set({ showExpiredModal: show }),

  clearSession: () => {
    set({
      activeSession: null,
      elapsedTime: null,
      remainingSeconds: null,
      startError: null,
      stopError: null,
      extendError: null,
      startingLabId: null,
      stoppingLabId: null,
      extendingSessionId: null,
      showWarningModal: false,
      showExtensionModal: false,
      showExpiredModal: false,
      warningAcknowledged: false
    });
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  },

  clearStartError: () => set({ startError: null }),

  setActiveSession: (session: LabSession | null) => {
    set({ activeSession: session });
    if (session && ['running', 'starting', 'expiring_soon', 'RUNNING', 'STARTING', 'EXPIRING_SOON'].includes(session.status)) {
      startCountdownTimer(get, set);
    } else {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    }
  }
}));
