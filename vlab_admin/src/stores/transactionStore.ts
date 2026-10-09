import { create } from 'zustand';
import { executeRequest } from '@/Utils/GetApiHandler';
import { useAuthStore } from '@/stores/auth-store';

export interface TransactionRecord {
  id: string;
  razorpayPaymentId?: string;
  date: string;
  description: string;
  labName?: string;
  labId?: string;
  type: 'Credit' | 'Debit';
  amount: number; // Amount in ₹ or Credits
  tokens?: number;
  amountRupees?: number;
  paymentMethod: 'Credit/Debit Card' | 'UPI Payment' | 'Netbanking' | 'Wallet' | 'PayLater' | 'Razorpay' | 'System Allocation' | string;
  studentEmail: string;
  studentPhone: string;
  studentName: string;
  status: 'Completed' | 'Pending' | 'Failed';
  failureReason?: string;
}

interface TransactionState {
  transactions: TransactionRecord[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  addTransaction: (tx: Omit<TransactionRecord, 'id' | 'date'> & { id?: string; date?: string }) => void;
  clearTransactions: () => void;
}

function prettyLabName(labId?: string) {
  const clean = String(labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
  if (!clean) return '';
  if (clean.includes('python')) return 'Python Programming Lab';
  if (clean.includes('java')) return 'Java Development Lab';
  if (clean.includes('linux')) return 'Linux Administration Lab';
  if (clean.includes('android')) return 'Android Application Lab';
  if (clean.includes('dotnet') || clean.includes('.net')) return '.NET Technologies Lab';
  return '';
}

/** One combined payment that names several labs becomes one row per lab. */
function expandLabPurchases(rows: TransactionRecord[]): TransactionRecord[] {
  const expanded: TransactionRecord[] = [];
  for (const tx of rows) {
    const match = String(tx.description || '').match(/combined token order:\s*(.+)$/i);
    if (!match) {
      expanded.push(tx);
      continue;
    }
    const parts: { name: string; tokens: number }[] = [];
    const re = /([^,]+?)\s*\((\d+)\s*tokens\)/gi;
    let found: RegExpExecArray | null;
    while ((found = re.exec(match[1]))) {
      parts.push({ name: found[1].trim(), tokens: Number(found[2]) });
    }
    if (parts.length < 2) {
      expanded.push(tx);
      continue;
    }
    const tokenSum = parts.reduce((sum, part) => sum + part.tokens, 0) || 1;
    const rupees = Number(tx.amountRupees ?? 0);
    parts.forEach((part, index) => {
      expanded.push({
        ...tx,
        id: `${tx.id}-${index}`,
        description: part.name,
        labName: part.name,
        amount: part.tokens,
        amountRupees: Math.round((part.tokens / tokenSum) * rupees),
      });
    });
  }
  return expanded;
}

function isTokenCutOrUsage(t: any): boolean {
  if (!t) return false;
  const tType = String(t.type || t.Type || '').toUpperCase();
  const source = String(t.source || t.Source || '').toUpperCase();
  const method = String(t.paymentMethod || '').toLowerCase();
  const id = String(t.id || t.transactionId || t.IdempotencyKey || '').toLowerCase();
  const desc = String(t.description || '').toLowerCase();

  return (
    tType === 'USAGE' ||
    tType === 'CONSUMPTION' ||
    tType === 'DEBIT' ||
    source === 'SESSION_USAGE' ||
    source === 'LAB_RUNTIME' ||
    method.includes('runtime') ||
    id.startsWith('session_') ||
    id.startsWith('sess-') ||
    id.includes('token_') ||
    desc.includes('finalized session') ||
    desc.includes('session runtime') ||
    desc.includes('runtime usage') ||
    desc.includes('consumed') ||
    desc.includes('token/s')
  );
}

function getStorageKey(user?: any): string {
  const u = user || (typeof window !== 'undefined' ? (() => {
    try {
      const raw = localStorage.getItem('auth-user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })() : null);
  const identifier = u?.userId || u?.id || u?.email;
  return identifier ? `vlab_student_transactions_${String(identifier).trim().toLowerCase()}` : '';
}

function getSavedTransactions(user?: any): TransactionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    // Purge legacy global key so stale transactions from deleted accounts are never retained
    localStorage.removeItem('vlab_student_transactions');

    const key = getStorageKey(user);
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: TransactionRecord[] = JSON.parse(raw);
    const cleaned = parsed.filter((t) => !isTokenCutOrUsage(t));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

function saveTransactions(txs: TransactionRecord[], user?: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('vlab_student_transactions');
    const key = getStorageKey(user);
    if (!key) return;
    const cleaned = (txs || []).filter((t) => !isTokenCutOrUsage(t));
    localStorage.setItem(key, JSON.stringify(cleaned));
  } catch (e) {}
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: getSavedTransactions(),
  isLoading: false,

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const currentUser = useAuthStore.getState()?.auth?.user;
      const res = await executeRequest('/credits/transactions', { auth: true });
      const rawList = res?.transactions || res?.data || [];
      
      // Exclude runtime token deductions completely
      const purchaseList = (rawList || []).filter((t: any) => !isTokenCutOrUsage(t));

      const formatted: TransactionRecord[] = expandLabPurchases(purchaseList.map((t: any) => {
        const labName = t.labName || t.LabName || prettyLabName(t.labId || t.LabId);
        const tType = String(t.type || t.Type || '').toUpperCase();
        const isAllocation = tType === 'ALLOCATION' || String(t.source || '').toUpperCase() === 'UNIVERSITY_ALLOCATION';

        return {
          id: t.idempotencyKey || t.transactionId || t.id || `TXN-${t.TransactionId}`,
          razorpayPaymentId: t.paymentReference || t.PaymentReference,
          date: t.createdAt || t.CreatedAt || new Date().toISOString(),
          description: t.description || (isAllocation ? `University Course Allocation: ${labName}` : `Token purchase: ${labName}`),
          labName: labName || 'Virtual Lab',
          labId: t.labId || t.LabId,
          type: 'Credit' as const,
          amount: Number(t.credits || t.Credits || t.amount || 0),
          tokens: Number(t.credits || t.Credits || t.amount || 0),
          amountRupees: !isAllocation ? Number(t.amount ?? t.Amount ?? t.credits ?? 0) : 0,
          paymentMethod: isAllocation 
            ? 'University Allocation' 
            : (t.source === 'STUDENT_PURCHASE' ? 'Razorpay' : (t.source || t.paymentMethod || 'Razorpay')),
          studentEmail: t.userEmail || t.studentEmail || currentUser?.email || '',
          studentPhone: t.userPhone || t.studentPhone || currentUser?.phoneNumber || currentUser?.mobile || '',
          studentName: t.userName || t.studentName || currentUser?.fullName || currentUser?.name || 'Student User',
          status: (t.status || t.Status || 'SUCCESS').toUpperCase() === 'SUCCESS' ? 'Completed' as const : 'Failed' as const
        };
      }));

      const mergedMap = new Map<string, TransactionRecord>();
      // First insert newly fetched transactions from server (server is source of truth)
      formatted.forEach((t) => mergedMap.set(String(t.id || t.razorpayPaymentId), t));

      // Only retain in-memory unconfirmed transactions created locally within the last 5 minutes
      // that explicitly match the current logged-in student's email
      const currentEmail = currentUser?.email?.toLowerCase();
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      get().transactions.forEach((t) => {
        if (!isTokenCutOrUsage(t)) {
          const isSameStudent = Boolean(currentEmail && t.studentEmail && t.studentEmail.toLowerCase() === currentEmail);
          const isRecent = t.date ? (new Date(t.date).getTime() > fiveMinutesAgo) : false;
          if (isSameStudent && isRecent) {
            const key = String(t.id || t.razorpayPaymentId);
            if (!mergedMap.has(key)) {
              mergedMap.set(key, t);
            }
          }
        }
      });

      const finalTransactions = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      saveTransactions(finalTransactions, currentUser);
      set({ transactions: finalTransactions, isLoading: false });
      return;
    } catch (e) {
      console.warn('Failed to fetch transactions from DB:', e);
    }
    set({ isLoading: false });
  },

  addTransaction: (tx) => {
    if (isTokenCutOrUsage(tx)) {
      return;
    }

    const currentUser = useAuthStore.getState()?.auth?.user;
    const newTx: TransactionRecord = {
      id: tx.id || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      date: tx.date || new Date().toISOString(),
      description: tx.description,
      labName: tx.labName || 'Virtual Lab',
      labId: tx.labId,
      type: tx.type || 'Credit',
      amount: tx.amount,
      amountRupees: tx.amountRupees ?? tx.amount,
      paymentMethod: tx.paymentMethod || 'Razorpay',
      studentEmail: tx.studentEmail || currentUser?.email || '',
      studentPhone: tx.studentPhone || '',
      studentName: tx.studentName || currentUser?.fullName || 'Student User',
      status: tx.status || 'Completed',
      razorpayPaymentId: tx.razorpayPaymentId,
    };

    set((state) => {
      const filtered = state.transactions.filter(
        (t) => !isTokenCutOrUsage(t) && t.id !== newTx.id && (!newTx.razorpayPaymentId || t.razorpayPaymentId !== newTx.razorpayPaymentId)
      );
      const updated = [newTx, ...filtered];
      saveTransactions(updated, currentUser);
      return { transactions: updated };
    });
  },

  clearTransactions: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('vlab_student_transactions');
        const currentUser = useAuthStore.getState()?.auth?.user;
        const key = getStorageKey(currentUser);
        if (key) localStorage.removeItem(key);
      } catch (_) {}
    }
    set(() => ({ transactions: [] }));
  },
}));
