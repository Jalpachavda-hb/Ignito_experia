import React, { useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Layers, PlayCircle, Wallet, GraduationCap } from 'lucide-react';
import { Lab } from '../types';
import { useLabTokenStore } from '@/stores/labTokenStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { isDirectStudent } from '@/lib/student-kind';

interface MyLabsHeaderProps {
  labs: Lab[];
  activeSession?: any;
  user?: any;
}

export function MyLabsHeader({ labs, activeSession, user }: MyLabsHeaderProps) {
  const { summary, labWallets, fetchStudentLabTokens } = useLabTokenStore();
  const { transactions } = useTransactionStore();

  useEffect(() => {
    fetchStudentLabTokens();
  }, [fetchStudentLabTokens]);

  const totalLabs = labs.length;
  const rawStatus = String(activeSession?.status || (activeSession as any)?.Status || '').toLowerCase();
  const isRunning = Boolean(activeSession && ['running', 'starting', 'expiring_soon'].includes(rawStatus));
  const activeSessionText = isRunning ? '1' : '0';
  
  // Real User Tokens calculated dynamically to match university allocations + personal purchased tokens
  const { totalBalance, uniTokens, personalTokens } = useMemo(() => {
    let uSum = 0;
    let pSum = 0;
    const seenLabIds = new Set<string>();

    (labs || []).forEach((l: any) => {
      const cleanId = String(l.id || l.labId || l.LabId || l.title || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
      seenLabIds.add(cleanId);
      const remaining = Number(l.remainingTokens ?? l.tokens ?? l.availableTokens ?? l.practicalCredit ?? 0);
      const isUni = l.accessType === 'university' || l.isUniversity || Boolean(l.courseCode);
      const isPersonal = l.accessType === 'personal' || l.isPurchased;

      if (isUni) {
        uSum += remaining > 0 ? remaining : (Number(l.practicalCredit) || 60);
      } else if (isPersonal) {
        pSum += remaining;
      }
    });

    // Also check labWallets for any personal labs not already counted
    (labWallets || []).forEach((w: any) => {
      const cleanWId = String(w.labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
      const rem = Number(w.remainingTokens ?? (Number(w.purchasedTokens || 0) - Number(w.usedTokens || 0)));
      if (rem > 0 && !seenLabIds.has(cleanWId)) {
        seenLabIds.add(cleanWId);
        pSum += rem;
      }
    });

    // Also check transactions for personal purchases
    const currentStudentEmail = user?.email?.toLowerCase();
    const liveTransactions = (transactions || []).filter(tx => {
      if (!currentStudentEmail) return true;
      return !tx.studentEmail || tx.studentEmail.toLowerCase() === currentStudentEmail;
    });

    let txPersonalSum = 0;
    liveTransactions.forEach((tx) => {
      const isSuccess = tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed');
      if (isSuccess && tx.type === 'Credit') {
        txPersonalSum += Number(tx.amount) || 0;
      }
    });

    if (pSum === 0 && txPersonalSum > 0) {
      pSum = txPersonalSum;
    } else if (txPersonalSum > pSum) {
      pSum = Math.max(pSum, txPersonalSum);
    }

    // Direct student fallback
    if (isDirectStudent(user) && uSum === 0) {
      if (pSum > 0) return { totalBalance: pSum, uniTokens: 0, personalTokens: pSum };
      if (summary?.totalRemaining) return { totalBalance: summary.totalRemaining, uniTokens: 0, personalTokens: summary.totalRemaining };
    }

    const total = uSum + pSum;
    return {
      totalBalance: total > 0 ? total : (summary?.totalRemaining || 0),
      uniTokens: uSum,
      personalTokens: pSum,
    };
  }, [labs, labWallets, summary, transactions, user]);
  
  // Real Enrolled Programs Count
  const isDirect = isDirectStudent(user);
  const hasLmsProgrammes = Boolean(user?.programmesList && user.programmesList.length > 0);
  const programCount = hasLmsProgrammes ? user!.programmesList!.length : (user?.programName ? 1 : 0);

  const stats = [
    {
      title: 'Total Labs',
      value: totalLabs,
      subtext: 'Assigned & Purchased',
      icon: Layers,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Active Session',
      value: activeSessionText,
      subtext: isRunning ? 'Container Live' : 'No Running Session',
      icon: PlayCircle,
      color: isRunning ? 'text-emerald-500' : 'text-orange-500',
      bg: isRunning ? 'bg-emerald-500/10' : 'bg-orange-500/10',
    },
    {
      title: 'Available Tokens',
      value: `${totalBalance}`,
      subtext: personalTokens > 0 && uniTokens > 0
        ? `${uniTokens} Uni • ${personalTokens} Personal`
        : personalTokens > 0
        ? `${personalTokens} Personal Tokens`
        : 'Wallet Balance',
      icon: Wallet,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    ...(!isDirect && hasLmsProgrammes ? [{
      title: 'Enrolled Programs',
      value: programCount,
      subtext: 'Academic Courses',
      icon: GraduationCap,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
    }] : []),
  ];

  return (
    <div className="mb-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Labs</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
          Access, launch, monitor and track your virtual laboratory environments. Continue where you left off or start a new lab challenge.
        </p>
      </div>

      <div className={`grid grid-cols-2 ${!isDirect && hasLmsProgrammes ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 ${stat.bg}`}></div>
            <CardContent className="p-5 flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {stat.title}
                </p>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {stat.value}
                </div>
                <p className="text-[11px] text-muted-foreground font-medium mt-1">
                  {stat.subtext}
                </p>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 ${stat.color} shrink-0`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
