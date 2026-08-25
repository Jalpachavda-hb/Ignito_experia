import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FlaskConical, Database, Clock, GraduationCap, PlayCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useTransactionStore } from '@/stores/transactionStore';
import { useLabStore } from '@/stores/labStore';
import { useLabSessionStore } from '@/stores/labSessionStore';

export function SummaryCards() {
  const { auth } = useAuthStore();
  const { user } = auth;
  const { transactions } = useTransactionStore();
  const { labs } = useLabStore();
  const { activeSession } = useLabSessionStore();

  // Real Available Credits
  const availableCredits = useMemo(() => {
    if (typeof user?.credits === 'number' && user.credits !== 1000) {
      return Math.max(0, Math.round(user.credits));
    }
    if (transactions && transactions.length > 0) {
      let netBalance = 0;
      let hasTx = false;
      transactions.forEach((t) => {
        if (t.status === 'Completed' || !t.status) {
          hasTx = true;
          if (t.type === 'Credit') netBalance += Number(t.amount) || 0;
          else if (t.type === 'Debit') netBalance -= Number(t.amount) || 0;
        }
      });
      if (hasTx) return Math.max(0, Math.round(netBalance));
    }
    return 0;
  }, [user, transactions]);

  // Real Credits Spent (Debits)
  const creditsSpent = useMemo(() => {
    return (transactions || [])
      .filter((t) => t.type === 'Debit' && (t.status === 'Completed' || !t.status))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  // Real Enrolled Programs Count
  const isDirect = user?.createdFrom === 'DIRECT' || user?.authType === 'DIRECT';
  const hasLmsProgrammes = Boolean(user?.programmesList && user.programmesList.length > 0);
  const programCount = hasLmsProgrammes ? user!.programmesList!.length : (user?.programName ? 1 : 0);
  const primaryProgramName = hasLmsProgrammes
    ? user!.programmesList![0].programmeName
    : (user?.programName || '');

  // Total Accessible Labs
  const totalLabs = labs.length || 0;

  // Active Session Status
  const isRunning = activeSession && activeSession.status === 'running';

  const cards = [
    {
      title: 'Total Labs',
      value: `${totalLabs} ${totalLabs === 1 ? 'Lab' : 'Labs'}`,
      description: 'Assigned & Purchased',
      icon: FlaskConical,
      color: 'text-rose-500 dark:text-rose-400',
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    },
    {
      title: 'Available Tokens',
      value: `${availableCredits} Tokens`,
      description: 'Active wallet balance',
      icon: Database,
      color: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    },
    {
      title: 'Tokens Spent',
      value: `${creditsSpent} Tokens`,
      description: 'Tokens consumed',
      icon: Clock,
      color: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    },
    ...(!isDirect && hasLmsProgrammes ? [{
      title: 'Enrolled Programs',
      value: `${programCount} ${programCount === 1 ? 'Program' : 'Programs'}`,
      description: primaryProgramName,
      icon: GraduationCap,
      color: 'text-purple-500 dark:text-purple-400',
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    }] : []),
    {
      title: 'Active Session',
      value: isRunning ? '1 Active' : '0 Running',
      description: isRunning ? 'Container Live' : 'No Running Session',
      icon: PlayCircle,
      color: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    },
  ];

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 ${!isDirect && hasLmsProgrammes ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
      {cards.map((card, i) => {
        const IconComponent = card.icon;
        return (
          <Card 
            key={i} 
            className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md rounded-[20px] bg-white dark:bg-slate-950"
          >
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full -mr-3 -mt-3 ${card.bg}`}></div>
            
            <CardContent className="p-5 flex items-center justify-between relative z-10 h-full">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 truncate">
                  {card.title}
                </p>
                <div className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  {card.value}
                </div>
                {card.description ? (
                  <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-full" title={card.description}>
                    {card.description}
                  </p>
                ) : null}
              </div>
              
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 shrink-0 ${card.color}`}>
                <IconComponent className="h-5.5 w-5.5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
