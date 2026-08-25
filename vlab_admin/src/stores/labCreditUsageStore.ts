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

const USAGE_STORAGE_KEY = 'ignito_student_lab_credit_usage';

const loadInitialUsage = (): LabUsageRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
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
          localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save lab credit usage:', e);
        }
      }
      return { usageRecords: updated };
    }),

  clearUsageRecords: () =>
    set(() => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USAGE_STORAGE_KEY);
      }
      return { usageRecords: [] };
    }),
}));
