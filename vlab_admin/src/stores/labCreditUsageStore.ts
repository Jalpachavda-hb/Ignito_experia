import { create } from 'zustand';

export interface LabUsageRecord {
  id: string;
  sessionId: string;
  labId: string;
  labName: string;
  date: string;
  creditsConsumed: number;
  minutesUsed: number;
  studentEmail: string;
  studentName: string;
  status: 'Completed';
}

interface LabCreditUsageState {
  usageRecords: LabUsageRecord[];
  addUsageRecord: (record: Omit<LabUsageRecord, 'id' | 'date'> & { id?: string; date?: string }) => void;
  clearUsageRecords: () => void;
}

function getUsageStorageKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const rawUser = localStorage.getItem('auth-user');
    const u = rawUser ? JSON.parse(rawUser) : null;
    const identifier = u?.userId || u?.id || u?.email;
    return identifier ? `ignito_student_lab_credit_usage_${String(identifier).trim().toLowerCase()}` : '';
  } catch {
    return '';
  }
}

const loadInitialUsage = (): LabUsageRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    localStorage.removeItem('ignito_student_lab_credit_usage');
    const key = getUsageStorageKey();
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load lab credit usage storage:', e);
  }
  return [];
};

export const useLabCreditUsageStore = create<LabCreditUsageState>((set) => ({
  usageRecords: loadInitialUsage(),

  addUsageRecord: (record) =>
    set((state) => {
      const newRecord: LabUsageRecord = {
        id: record.id || `USG-${Math.floor(100000 + Math.random() * 900000)}`,
        sessionId: record.sessionId || `sess_${Date.now()}`,
        labId: record.labId,
        labName: record.labName || 'Virtual Lab',
        date: record.date || new Date().toISOString(),
        creditsConsumed: Number(record.creditsConsumed || 0),
        minutesUsed: Number(record.minutesUsed || 1),
        studentEmail: (record.studentEmail || '').trim().toLowerCase(),
        studentName: record.studentName || 'Student User',
        status: 'Completed',
      };

      const updated = [newRecord, ...state.usageRecords];
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('ignito_student_lab_credit_usage');
          const key = getUsageStorageKey();
          if (key) localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save lab credit usage:', e);
        }
      }
      return { usageRecords: updated };
    }),

  clearUsageRecords: () =>
    set(() => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('ignito_student_lab_credit_usage');
          const key = getUsageStorageKey();
          if (key) localStorage.removeItem(key);
        } catch (_) {}
      }
      return { usageRecords: [] };
    }),
}));
