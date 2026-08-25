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

// Clear any residual localStorage cache from previous test runs
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('vlab_student_transactions');
  } catch (e) {
    // Ignored
  }
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: false,

  fetchTransactions: async () => {
    set({ isLoading: true });
    try {
      const res = await executeRequest('/credits/transactions', { auth: true });
      const rawList = res?.transactions || res?.data || [];
      const currentUser = useAuthStore.getState()?.auth?.user;
      const formatted: TransactionRecord[] = rawList.map((t: any) => ({
        id: t.idempotencyKey || t.transactionId || t.id || `TXN-${t.TransactionId}`,
        razorpayPaymentId: t.paymentReference || t.PaymentReference,
        date: t.createdAt || t.CreatedAt || new Date().toISOString(),
        description: t.description || (t.type === 'PURCHASE' ? 'Combined Token Order: Python (60 Tokens), Java Development Lab (60 Tokens)' : 'Lab Session Usage'),
        labName: t.labName || t.LabName || 'Virtual Lab',
        labId: t.labId || t.LabId,
        type: (t.type === 'PURCHASE' || t.type === 'ALLOCATION' || t.type === 'Credit' || t.Type === 'PURCHASE') ? 'Credit' : 'Debit',
        amount: Number(t.credits || t.Credits || t.amount || 0),
        amountRupees: Number(t.amount || t.Amount || t.credits || 0),
        paymentMethod: t.source === 'STUDENT_PURCHASE' ? 'Razorpay' : (t.source || t.paymentMethod || 'Razorpay'),
        studentEmail: t.userEmail || t.studentEmail || currentUser?.email || '',
        studentPhone: t.userPhone || t.studentPhone || currentUser?.phoneNumber || currentUser?.mobile || '',
        studentName: t.userName || t.studentName || currentUser?.fullName || currentUser?.name || 'Student User',
        status: (t.status || t.Status || 'SUCCESS').toUpperCase() === 'SUCCESS' ? 'Completed' : 'Failed'
      }));
      set({ transactions: formatted, isLoading: false });
      return;
    } catch (e) {
      console.warn('Failed to fetch transactions from DB:', e);
    }
    set({ isLoading: false });
  },

  addTransaction: (tx) =>
    set((state) => {
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

      return { transactions: [newTx, ...state.transactions] };
    }),

  clearTransactions: () =>
    set(() => ({ transactions: [] })),
}));
