import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight, Activity, Wallet, Calendar } from 'lucide-react';
import { Transaction } from '@/pages/student/dashboard/types';

interface TransactionsHeaderProps {
  transactions: Transaction[];
  totalCredits: number;
}

export function TransactionsHeader({ transactions, totalCredits }: TransactionsHeaderProps) {
  const creditsAdded = transactions
    .filter(t => t.type === 'Credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const creditsConsumed = transactions
    .filter(t => t.type === 'Debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    const now = new Date('2024-03-20'); // Mocking current date for demo
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
  }).length;

  const cards = [
    {
      title: 'Total Transactions',
      value: transactions.length,
      icon: Activity,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      description: 'Lifetime record'
    },
    {
      title: 'Credits Added',
      value: `+${creditsAdded}`,
      icon: ArrowUpRight,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      description: 'Purchases & Rewards'
    },
    {
      title: 'Credits Consumed',
      value: `-${creditsConsumed}`,
      icon: ArrowDownRight,
      color: 'text-rose-600',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
      description: 'Lab usage'
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
      title: 'Total Value',
      value: totalCredits,
      icon: Wallet,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      description: 'Net allocated credits'
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
