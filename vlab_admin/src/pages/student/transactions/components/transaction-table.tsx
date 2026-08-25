import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  MoreVertical,
  Eye,
  FileText,
  CreditCard,
  Mail,
  Phone,
  QrCode,
  Building2,
  Wallet,
  Clock,
  XCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useTransactionStore, TransactionRecord } from '@/stores/transactionStore';
import { useAuthStore } from '@/stores/auth-store';
import { TransactionDrawer } from './transaction-drawer';
import { ReceiptModal } from './receipt-modal';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TransactionTableProps {
  transactions?: any[];
}

export function TransactionTable({ transactions: propTransactions }: TransactionTableProps) {
  const { auth } = useAuthStore();
  const { transactions: storeTransactions } = useTransactionStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Completed' | 'Failed' | 'Pending'>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);
  const [receiptTx, setReceiptTx] = useState<TransactionRecord | null>(null);

  const currentStudentEmail = auth?.user?.email?.toLowerCase();

  // All transactions returned by the backend API are already strictly scoped to this authenticated student
  const allTransactions = storeTransactions || [];

  const filteredTransactions = allTransactions.filter(tx => {
    const search = (searchTerm || '').toLowerCase();
    const id = String(tx?.id || '').toLowerCase();
    const desc = String(tx?.description || '').toLowerCase();
    const email = String(tx?.studentEmail || '').toLowerCase();
    const method = String(tx?.paymentMethod || '').toLowerCase();
    const payId = String(tx?.razorpayPaymentId || '').toLowerCase();

    const matchesSearch =
      !search ||
      id.includes(search) ||
      desc.includes(search) ||
      email.includes(search) ||
      method.includes(search) ||
      payId.includes(search);

    const matchesStatus = statusFilter === 'ALL' || tx?.status === statusFilter;
    const matchesMethod =
      methodFilter === 'ALL' ||
      method.includes(methodFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const renderMethodBadge = (method?: string) => {
    const m = (method || 'Razorpay').toLowerCase();
    let Icon = CreditCard;
    let colorClass = 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900';

    if (m.includes('upi')) {
      Icon = QrCode;
      colorClass = 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900';
    } else if (m.includes('netbanking') || m.includes('bank')) {
      Icon = Building2;
      colorClass = 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900';
    } else if (m.includes('wallet')) {
      Icon = Wallet;
      colorClass = 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900';
    } else if (m.includes('paylater')) {
      Icon = Clock;
      colorClass = 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900';
    }

    return (
      <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 whitespace-nowrap ${colorClass}`}>
        <Icon className="w-3 h-3 mr-1 shrink-0" />
        {method || 'Razorpay'}
      </Badge>
    );
  };

  const renderStatusBadge = (status?: string) => {
    if (status === 'Failed') {
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900 text-[10px] font-bold">
          <XCircle className="w-3 h-3 mr-1 text-rose-500" /> Failed
        </Badge>
      );
    }
    if (status === 'Pending') {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900 text-[10px] font-bold">
          <AlertCircle className="w-3 h-3 mr-1 text-amber-500" /> Pending
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 text-[10px] font-bold">
        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Completed
      </Badge>
    );
  };

  return (
    <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4 bg-white dark:bg-card">
        <div>
          <CardTitle className="text-xl font-bold">Transaction History</CardTitle>
          <p className="text-xs text-slate-500 mt-1 font-medium">All student payments (Completed & Failed with Bank Details), Razorpay checkout receipts, and credit allocations.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('Completed')}
              className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'Completed' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500'}`}
            >
              Completed
            </button>
            <button
              onClick={() => setStatusFilter('Failed')}
              className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'Failed' ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs' : 'text-slate-500'}`}
            >
              Failed
            </button>
          </div>

          {/* Payment Method Filter Dropdown */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Methods</option>
            <option value="netbanking">Netbanking (Banks)</option>
            <option value="card">Credit / Debit Card</option>
            <option value="upi">UPI Payment</option>
            <option value="wallet">Wallet</option>
            <option value="paylater">PayLater</option>
          </select>

          <div className="relative max-w-sm w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search ID, Bank, Email..."
              className="pl-9 h-9 w-full sm:w-60 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-900/50 uppercase tracking-wider font-extrabold border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Transaction ID</th>
                <th className="px-6 py-3.5">Date & Time</th>
                <th className="px-6 py-3.5">Student Details</th>
                <th className="px-6 py-3.5">Description / Lab</th>
                <th className="px-6 py-3.5">Method & Bank</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.type === 'Credit';
                  const isFailed = tx.status === 'Failed';
                  let formattedDate = 'Recent';
                  try {
                    if (tx.date) {
                      formattedDate = new Date(tx.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    }
                  } catch {
                    formattedDate = String(tx.date || 'Recent');
                  }

                  return (
                    <tr key={tx.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors ${isFailed ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''}`}>
                      {/* Transaction ID */}
                      <td className="px-6 py-4 font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                        {tx.id}
                        {tx.razorpayPaymentId && (
                          <span className="block text-[10px] font-normal text-slate-400 font-sans truncate max-w-[130px]" title={tx.razorpayPaymentId}>
                            {tx.razorpayPaymentId}
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Student Info */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {tx.studentName || 'Student User'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" /> {tx.studentEmail || 'N/A'}
                          </span>
                          {tx.studentPhone && (
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {tx.studentPhone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {tx.description}
                        {tx.failureReason && (
                          <span className="block text-[10px] text-rose-500 font-medium mt-0.5">
                            Reason: {tx.failureReason}
                          </span>
                        )}
                      </td>

                      {/* Payment Method & Bank */}
                      <td className="px-6 py-4">
                        {renderMethodBadge(tx.paymentMethod)}
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`font-black text-sm ${isFailed ? 'text-rose-500 line-through opacity-80' : isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                            ₹{tx.amountRupees ?? tx.amount}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {isFailed ? '0 Credits' : `+${tx.amount} Credits`}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        {renderStatusBadge(tx.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isFailed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReceiptTx(tx)}
                              className="h-8 px-2.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg flex items-center gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" /> Receipt
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTx(tx)}
                              className="h-8 px-2.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1"
                            >
                              <AlertCircle className="h-3.5 w-3.5" /> Details
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreVertical className="h-4 w-4 text-slate-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl">
                              <DropdownMenuItem onClick={() => setSelectedTx(tx)} className="text-xs font-semibold">
                                <Eye className="h-4 w-4 mr-2 text-slate-500" /> View Details
                              </DropdownMenuItem>
                              {!isFailed && (
                                <DropdownMenuItem onClick={() => setReceiptTx(tx)} className="text-xs font-semibold">
                                  <Download className="h-4 w-4 mr-2 text-indigo-500" /> Download Receipt
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No transactions found matching your search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <TransactionDrawer
        transaction={selectedTx as any}
        open={!!selectedTx}
        onOpenChange={(open) => !open && setSelectedTx(null)}
      />

      <ReceiptModal
        transaction={receiptTx}
        open={!!receiptTx}
        onClose={() => setReceiptTx(null)}
      />
    </Card>
  );
}
