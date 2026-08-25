import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, Database, Clock, FlaskConical, PlayCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useTransactionStore } from '@/stores/transactionStore'
import { useLabCreditUsageStore } from '@/stores/labCreditUsageStore'
import { useLabStore } from '@/stores/labStore'
import { useLabSessionStore } from '@/stores/labSessionStore'

import { useLabTokenStore } from '@/stores/labTokenStore'

export function StatsCards() {
  const { auth } = useAuthStore()
  const { user } = auth
  const { transactions: rawTransactions } = useTransactionStore()
  const { usageRecords } = useLabCreditUsageStore()
  const { labs } = useLabStore()
  const { activeSession } = useLabSessionStore()
  const { summary } = useLabTokenStore()

  const currentStudentEmail = user?.email?.toLowerCase()

  // Real Available Tokens directly from live wallet summary
  const availableCredits = useMemo(() => {
    if (summary && typeof summary.totalRemaining === 'number') {
      return summary.totalRemaining;
    }
    if (typeof user?.tokens === 'number' && user.tokens > 0) {
      return Math.max(0, Math.round(user.tokens));
    }
    if (typeof user?.credits === 'number' && user.credits !== 1000 && user.credits > 0) {
      return Math.max(0, Math.round(user.credits));
    }
    return 0;
  }, [summary, user]);

  // Real Credits Consumed from Lab Practice (strictly per logged in student)
  const creditsSpent = useMemo(() => {
    if (summary && typeof summary.totalUsed === 'number') {
      return summary.totalUsed;
    }
    if (summary && typeof summary.totalPurchased === 'number') {
      return Math.max(0, summary.totalPurchased - availableCredits);
    }
    return 0;
  }, [summary, availableCredits]);

  // Real Enrolled Programs Count
  const isDirect = user?.createdFrom === 'DIRECT' || user?.authType === 'DIRECT';
  const hasLmsProgrammes = Boolean(user?.programmesList && user.programmesList.length > 0);
  const programCount = hasLmsProgrammes ? user!.programmesList!.length : (user?.programName ? 1 : 0);
  const primaryProgramName = hasLmsProgrammes
    ? user!.programmesList![0].programmeName
    : (user?.programName || '');

  // Total Accessible Labs
  const totalLabs = labs.length || 0

  // Active Session Status
  const rawActiveStatus = String(activeSession?.status || (activeSession as any)?.Status || '').toLowerCase();
  const isRunning = Boolean(activeSession && ['running', 'starting', 'expiring_soon'].includes(rawActiveStatus));

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${!isDirect && hasLmsProgrammes ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-4 lg:gap-6`}>
      
      {/* 1. Enrolled Programs (LMS Students only) */}
      {!isDirect && hasLmsProgrammes ? (
        <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium">Enrolled Programs</CardTitle>
            <GraduationCap className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {programCount} {programCount === 1 ? 'Program' : 'Programs'}
            </div>
            {primaryProgramName ? (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={primaryProgramName}>
                {primaryProgramName}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* 2. Available Tokens */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Available Tokens</CardTitle>
          <Database className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {availableCredits}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Active wallet balance
          </p>
        </CardContent>
      </Card>

      {/* 3. Tokens Spent */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Tokens Spent</CardTitle>
          <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {creditsSpent}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tokens consumed
          </p>
        </CardContent>
      </Card>

      {/* 4. Accessible Labs */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Accessible Labs</CardTitle>
          <FlaskConical className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalLabs} {totalLabs === 1 ? 'Lab' : 'Labs'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Virtual lab environments
          </p>
        </CardContent>
      </Card>

      {/* 5. Active Session */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Active Session</CardTitle>
          <PlayCircle className="h-4 w-4 text-indigo-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {isRunning ? '1' : '0'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isRunning ? 'Container Live' : 'No Running Session'}
          </p>
        </CardContent>
      </Card>

    </div>
  )
}
