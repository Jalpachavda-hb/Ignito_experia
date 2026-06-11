
import { Card } from '@/components/ui/card';
import { CreditWallet, Transaction } from '../types';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  wallet: CreditWallet;
  transactions: Transaction[];
}

export function CreditWalletSummary({
  wallet,
  transactions,
}: Props) {
  const progressValue =
    wallet.totalCredits > 0
      ? (wallet.usedCredits / wallet.totalCredits) * 100
      : 0;

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col rounded-xl p-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-bold text-foreground">
          Credit Wallet
        </h3>

        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Wallet className="h-5 w-5 text-emerald-600" />
        </div>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
            {wallet.remainingCredits}
          </span>

          <p className="text-sm font-medium text-slate-500 mt-1">
            Credits Remaining
          </p>
        </div>

        <div className="text-right">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {wallet.usedCredits} / {wallet.totalCredits}
          </span>

          <p className="text-xs font-medium text-slate-500">
            Used / Total
          </p>
        </div>
      </div>

      <Progress
        value={progressValue}
        className="h-3 bg-slate-100 dark:bg-slate-800 mb-8 rounded-full"
      />

      <div className="mt-2">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">
          Recent Transactions
        </h4>

        <div className="space-y-5">
          {transactions.slice(0, 3).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                {tx.type === 'Debit' ? (
                  <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="h-5 w-5 text-red-500" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                    <ArrowDownRight className="h-5 w-5 text-emerald-500" />
                  </div>
                )}

                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {tx.description}
                  </p>

                  <p className="text-xs font-medium text-slate-400">
                    {new Date(tx.date).toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <span
                className={`text-sm font-bold ${
                  tx.type === 'Debit'
                    ? 'text-red-600'
                    : 'text-emerald-600'
                }`}
              >
                {tx.type === 'Debit' ? '-' : '+'}
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}