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

function getSavedTransactions(): TransactionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('vlab_student_transactions');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTransactions(txs: TransactionRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('vlab_student_transactions', JSON.stringify(txs));
  } catch (e) {}
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: getSavedTransactions(),
  isLoading: false,

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const res = await executeRequest('/credits/transactions', { auth: true });
      const rawList = res?.transactions || res?.data || [];
      const currentUser = useAuthStore.getState()?.auth?.user;
      const formatted: TransactionRecord[] = expandLabPurchases(rawList.map((t: any) => {
        const labName = t.labName || t.LabName || prettyLabName(t.labId || t.LabId);
        const tType = String(t.type || t.Type || '').toUpperCase();
        const isCredit = tType === 'PURCHASE' || tType === 'ALLOCATION' || tType === 'CREDIT';
        const isAllocation = tType === 'ALLOCATION' || String(t.source || '').toUpperCase() === 'UNIVERSITY_ALLOCATION';
        const isUsage = tType === 'USAGE' || tType === 'CONSUMPTION' || String(t.source || '').toUpperCase() === 'SESSION_USAGE';

        return {
          id: t.idempotencyKey || t.transactionId || t.id || `TXN-${t.TransactionId}`,
          razorpayPaymentId: t.paymentReference || t.PaymentReference,
          date: t.createdAt || t.CreatedAt || new Date().toISOString(),
          description: t.description || (isAllocation ? `University Course Allocation: ${labName}` : isCredit ? `Token purchase: ${labName}` : `${labName} Session Runtime Usage`),
          labName: labName || 'Virtual Lab',
          labId: t.labId || t.LabId,
          type: isCredit ? 'Credit' as const : 'Debit' as const,
          amount: Number(t.credits || t.Credits || t.amount || 0),
          tokens: Number(t.credits || t.Credits || t.amount || 0),
          amountRupees: isCredit && !isAllocation ? Number(t.amount ?? t.Amount ?? t.credits ?? 0) : 0,
          paymentMethod: isAllocation 
            ? 'University Allocation' 
            : isUsage 
            ? 'Lab Runtime' 
            : (t.source === 'STUDENT_PURCHASE' ? 'Razorpay' : (t.source || t.paymentMethod || 'Razorpay')),
          studentEmail: t.userEmail || t.studentEmail || currentUser?.email || '',
          studentPhone: t.userPhone || t.studentPhone || currentUser?.phoneNumber || currentUser?.mobile || '',
          studentName: t.userName || t.studentName || currentUser?.fullName || currentUser?.name || 'Student User',
          status: (t.status || t.Status || 'SUCCESS').toUpperCase() === 'SUCCESS' ? 'Completed' as const : 'Failed' as const
        };
      }));

      const mergedMap = new Map<string, TransactionRecord>();
      // First insert newly fetched transactions
      formatted.forEach((t) => mergedMap.set(String(t.id || t.razorpayPaymentId), t));
      // Then merge any existing local transactions so freshly made purchases are preserved
      get().transactions.forEach((t) => {
        const key = String(t.id || t.razorpayPaymentId);
        if (!mergedMap.has(key)) {
          mergedMap.set(key, t);
        }
      });
      const finalTransactions = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      saveTransactions(finalTransactions);
      set({ transactions: finalTransactions, isLoading: false });
      return;
    } catch (e) {
      console.warn('Failed to fetch transactions from DB:', e);
    }
    set({ isLoading: false });
  },

  addTransaction: (tx) => {
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
      studentEmail: tx.studentEmail || '',
      studentPhone: tx.studentPhone || '',
      studentName: tx.studentName || 'Student User',
      status: tx.status || 'Completed',
      razorpayPaymentId: tx.razorpayPaymentId,
    };

    set((state) => {
      const filtered = state.transactions.filter(
        (t) => t.id !== newTx.id && (!newTx.razorpayPaymentId || t.razorpayPaymentId !== newTx.razorpayPaymentId)
      );
      const updated = [newTx, ...filtered];
      saveTransactions(updated);
      return { transactions: updated };
    });
  },

  clearTransactions: () => {
    saveTransactions([]);
    set(() => ({ transactions: [] }));
  },
}));
