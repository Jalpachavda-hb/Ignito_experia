import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowUpRight, ArrowDownRight, Clock, Mail, Phone, CreditCard, Hash, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';

interface TransactionDrawerProps {
  transaction: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDrawer({ transaction, open, onOpenChange }: TransactionDrawerProps) {
  if (!transaction) return null;

  const isCredit = transaction.type === 'Credit';
  const isFailed = transaction.status === 'Failed';
  const formattedDate = new Date(transaction.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6">
        
        {/* Header */}
        <SheetHeader className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
          <SheetTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
            <span>Transaction Details</span>
            {isFailed ? (
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900 text-xs font-bold">
                <XCircle className="w-3 h-3 mr-1 text-rose-500" /> Failed
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 text-xs font-bold">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Completed
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500 font-medium font-mono">
            {transaction.id} &bull; {formattedDate}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          
          {/* Main Summary Box */}
          <div className={`p-4 rounded border flex items-center justify-between ${
            isFailed 
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' 
              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded flex items-center justify-center ${
                isFailed 
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' 
                  : isCredit 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' 
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
              }`}>
                {isFailed ? (
                  <XCircle className="h-5 w-5 text-rose-600" />
                ) : isCredit ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {isFailed ? 'Payment Failed' : isCredit ? 'Credits Top-Up' : 'Credits Usage'}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                  {transaction.description || 'Lab Transaction'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-xl font-black font-mono ${
                isFailed 
                  ? 'text-rose-600 line-through opacity-80' 
                  : isCredit 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-rose-600'
              }`}>
                ₹{transaction.amountRupees ?? transaction.amount}
              </div>
              <span className="text-[10px] font-bold text-slate-500">
                {isFailed ? '0 Credits' : `+${transaction.amount} Credits`}
              </span>
            </div>
          </div>

          {/* Failure Alert Box */}
          {isFailed && (
            <div className="p-3.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> Payment Declined / Failed
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed font-medium">
                {transaction.failureReason || "Your payment didn't go through as it was declined by the bank. Try another payment method or contact your bank."}
              </p>
            </div>
          )}

          {/* Transaction Metadata Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Information</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" /> Reference No.
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white font-mono break-all">{transaction.id}</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-400" /> Payment Method & Bank
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">{transaction.paymentMethod || 'Razorpay'}</div>
              </div>

              {transaction.razorpayPaymentId && (
                <div className="col-span-1 sm:col-span-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Razorpay Payment / Order ID</div>
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono break-all">{transaction.razorpayPaymentId}</div>
                </div>
              )}

              <div className="col-span-1 sm:col-span-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Student Details</div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">{transaction.studentName || 'Student User'}</div>
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {transaction.studentEmail || 'student@ignito.edu'}</span>
                  {transaction.studentPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {transaction.studentPhone}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Timeline</h4>
            <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 space-y-6 pb-2">
              
              <div className="relative pl-5">
                <div className="absolute -left-[7px] top-0.5 h-3.5 w-3.5 rounded bg-emerald-500 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Transaction Initiated</div>
                  <div className="text-[11px] text-slate-500 font-medium">{formattedDate}</div>
                </div>
              </div>

              <div className="relative pl-5">
                <div className="absolute -left-[7px] top-0.5 h-3.5 w-3.5 rounded bg-indigo-500 flex items-center justify-center">
                  <Clock className="h-2.5 w-2.5 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Payment Gateway Attempt</div>
                  <div className="text-[11px] text-slate-500 font-medium">Processed via {transaction.paymentMethod || 'Razorpay'}</div>
                </div>
              </div>

              {isFailed ? (
                <div className="relative pl-5">
                  <div className="absolute -left-[7px] top-0.5 h-3.5 w-3.5 rounded bg-rose-500 flex items-center justify-center">
                    <XCircle className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400">Payment Failed</div>
                    <div className="text-[11px] text-slate-500 font-medium">Transaction failed or declined by bank. No credits added.</div>
                  </div>
                </div>
              ) : (
                <div className="relative pl-5">
                  <div className="absolute -left-[7px] top-0.5 h-3.5 w-3.5 rounded bg-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Completed</div>
                    <div className="text-[11px] text-slate-500 font-medium">Credits credited to lab balance.</div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
