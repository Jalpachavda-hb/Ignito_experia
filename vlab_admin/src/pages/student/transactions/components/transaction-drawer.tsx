import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Transaction } from '@/pages/student/dashboard/types';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

interface TransactionDrawerProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDrawer({ transaction, open, onOpenChange }: TransactionDrawerProps) {
  if (!transaction) return null;

  const isCredit = transaction.type === 'Credit';
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl flex items-center gap-2">
            Transaction Details
          </SheetTitle>
          <SheetDescription>
            {transaction.id} • {new Date(transaction.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Main Amount Card */}
          <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center space-y-2 ${
            isCredit ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30' : 
            'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
              isCredit ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50' : 
              'bg-rose-100 text-rose-600 dark:bg-rose-900/50'
            }`}>
              {isCredit ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
            </div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              {isCredit ? 'Credits Added' : 'Credits Deducted'}
            </div>
            <div className={`text-4xl font-extrabold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isCredit ? '+' : '-'}{transaction.amount}
            </div>
            <Badge variant="outline" className="mt-2 bg-white dark:bg-slate-950">
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> Completed
            </Badge>
          </div>

          {/* Details Grid */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Information</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 mb-1.5">Transaction Type</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white break-words">{isCredit ? 'Credit Allocation' : 'Lab Launch'}</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 mb-1.5">Reference No.</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white break-words">{transaction.id}</div>
              </div>
              <div className="col-span-1 sm:col-span-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 mb-1.5">Description</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white break-words">{transaction.description}</div>
              </div>
            </div>
          </div>

          {/* Timeline Activity */}
          <div className="space-y-5 pt-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Activity Timeline</h4>
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8 pb-4">
              
              <div className="relative pl-6">
                <div className="absolute -left-[11px] top-0 h-5 w-5 rounded-full bg-white dark:bg-slate-950 border-2 border-emerald-500 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                </div>
                <div className="-mt-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Transaction Initiated</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">{new Date(transaction.date).toLocaleDateString()} • System</div>
                </div>
              </div>

              <div className="relative pl-6">
                <div className="absolute -left-[11px] top-0 h-5 w-5 rounded-full bg-white dark:bg-slate-950 border-2 border-blue-500 flex items-center justify-center">
                  <Clock className="h-3 w-3 text-blue-500" />
                </div>
                <div className="-mt-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Processing</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">Automated Validation</div>
                </div>
              </div>

              <div className="relative pl-6">
                <div className="absolute -left-[11px] top-0 h-5 w-5 rounded-full bg-white dark:bg-slate-950 border-2 border-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="-mt-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Completed</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">Wallet balance updated successfully.</div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
