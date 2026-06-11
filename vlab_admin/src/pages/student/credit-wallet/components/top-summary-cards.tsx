import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, ShoppingCart, Gift, CreditCard } from 'lucide-react';

interface SummaryStats {
  availableBalance: number;
  purchasedCredits: number;
  bonusCredits: number;
  earnedCredits: number;
}

interface TopSummaryCardsProps {
  stats: SummaryStats;
}

export function TopSummaryCards({ stats }: TopSummaryCardsProps) {
  const cards = [
    {
      title: 'Available Balance',
      value: stats.availableBalance,
      icon: Wallet,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Purchased',
      value: stats.purchasedCredits,
      icon: ShoppingCart,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      title: 'Bonus Earned',
      value: stats.bonusCredits + stats.earnedCredits,
      icon: Gift,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Allocated',
      value: 500, // From semester data
      icon: CreditCard,
      color: 'text-slate-500',
      bg: 'bg-slate-500/10',
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((stat, i) => (
        <Card key={i} className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 ${stat.bg}`}></div>
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {stat.title}
              </p>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {stat.value}
              </div>
            </div>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
