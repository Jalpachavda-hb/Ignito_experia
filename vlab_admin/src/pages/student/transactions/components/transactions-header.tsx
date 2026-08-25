import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight, Activity, Wallet, Calendar } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTransactionStore } from '@/stores/transactionStore';
import { useLabTokenStore } from '@/stores/labTokenStore';

export function TransactionsHeader() {
  const { auth } = useAuthStore();
  const { user } = auth;
  const { transactions: liveTransactions } = useTransactionStore();
  const { summary, labWallets } = useLabTokenStore();

  const currentStudentEmail = user?.email?.toLowerCase();

  const studentTransactions = liveTransactions || [];

  const creditsAdded = useMemo(() => {
    if (summary && typeof summary.totalPurchased === 'number' && summary.totalPurchased > 0) {
      return summary.totalPurchased;
    }
    return studentTransactions
      .filter(t => t.type === 'Credit' && (t.status === 'Completed' || !t.status))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [summary, studentTransactions]);

  const creditsConsumed = useMemo(() => {
    if (summary && typeof summary.totalUsed === 'number') {
      return summary.totalUsed;
    }
    const walletUsed = (labWallets || []).reduce((sum, w) => sum + (Number(w.usedTokens || 0)), 0);
    if (walletUsed > 0) return walletUsed;

    return studentTransactions
      .filter(t => t.type === 'Debit' && (t.status === 'Completed' || !t.status))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [summary, labWallets, studentTransactions]);

  const availableCredits = useMemo(() => {
    if (summary && typeof summary.totalRemaining === 'number') {
      return summary.totalRemaining;
    }
    if (typeof user?.tokens === 'number' && user.tokens > 0) {
      return Math.max(0, Math.round(user.tokens));
    }
    if (typeof user?.credits === 'number' && user.credits !== 1000) {
      return Math.max(0, Math.round(user.credits));
    }
    if (studentTransactions && studentTransactions.length > 0) {
      return Math.max(0, Math.round(creditsAdded - creditsConsumed));
    }
    return 0;
  }, [summary, user, studentTransactions, creditsAdded, creditsConsumed]);

  const now = new Date();
  const currentMonthTransactions = studentTransactions.filter(t => {
    if (!t.date) return false;
    const txDate = new Date(t.date);
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
  }).length;

  const cards = [
    {
      title: 'Total Transactions',
      value: studentTransactions.length,
      icon: Activity,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      description: 'Lifetime record'
    },
    {
      title: 'Tokens Added',
      value: `+${creditsAdded}`,
      icon: ArrowUpRight,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      description: 'Purchases & Top-ups'
    },
    {
      title: 'Tokens Consumed',
      value: `-${creditsConsumed}`,
      icon: ArrowDownRight,
      color: 'text-rose-600',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
      description: 'Lab session usage'
    },
    {
      title: 'Current Month',
      value: currentMonthTransactions,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      description: 'Transactions this month'
    },
    {
      title: 'Available Tokens',
      value: availableCredits,
      icon: Wallet,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      description: 'Active wallet balance'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((stat, i) => (
        <Card key={i} className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 ${stat.bgColor}`}></div>
          <CardContent className="p-5 flex items-center justify-between relative z-10 h-full">
            <div className="flex flex-col justify-between h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {stat.title}
              </p>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {stat.value}
              </div>
            </div>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 shrink-0 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
