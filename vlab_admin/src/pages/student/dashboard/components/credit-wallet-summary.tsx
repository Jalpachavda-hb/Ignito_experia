import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Wallet, ArrowUpRight, ArrowDownRight, ArrowRight, Coins, PlusCircle, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useTransactionStore } from '@/stores/transactionStore';
import { useLabCreditUsageStore } from '@/stores/labCreditUsageStore';
import { useLabTokenStore } from '@/stores/labTokenStore';
import { TokenPackagesModal } from '@/pages/student/my-labs/components/token-packages-modal';
import { getSavedLabActivities } from '@/Utils/labActivityTracker';
import { Link } from '@tanstack/react-router';

export function CreditWalletSummary() {
  const { auth } = useAuthStore();
  const { user } = auth;
  const { summary, labWallets, fetchStudentLabTokens } = useLabTokenStore();
  const { transactions: rawTransactions, fetchTransactions } = useTransactionStore();
  const { usageRecords } = useLabCreditUsageStore();

  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState<string | undefined>();

  useEffect(() => {
    fetchStudentLabTokens();
    fetchTransactions();
  }, [fetchStudentLabTokens, fetchTransactions]);

  const currentStudentEmail = user?.email?.toLowerCase();

  // Live transactions returned from backend are already scoped to this student
  const liveTransactions = rawTransactions || [];

  // Filter ONLY successful/completed transactions for dashboard summary list
  const successfulTransactions = useMemo(() => {
    return liveTransactions.filter(tx => tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed'));
  }, [liveTransactions]);

  const [activeTab, setActiveTab] = useState<'consumed' | 'topups'>('consumed');

  // Dynamic lab practice usage records from real-time database labWallets
  const combinedUsageList = useMemo(() => {
    const list: any[] = [];

    (labWallets || []).forEach(w => {
      const used = Number(w.usedTokens || 0);
      if (used > 0) {
        const rawId = String(w.labId || '').toLowerCase().trim();
        const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');
        let labName = 'Virtual Lab';
        if (cleanId.includes('python')) labName = 'Python Programming Lab';
        else if (cleanId.includes('java')) labName = 'Java Development Lab';
        else if (cleanId.includes('linux')) labName = 'Linux Administration Lab';
        else if (cleanId.includes('android')) labName = 'Android Application Lab';
        else if (cleanId.includes('dotnet')) labName = '.NET Technologies Lab';
        else labName = `${rawId.toUpperCase()} Lab`;

        list.push({
          id: `usage-${cleanId}`,
          labId: cleanId,
          labName,
          creditsConsumed: used,
          tokensConsumed: used,
          minutesUsed: used,
          date: w.updatedAt || new Date().toISOString(),
          status: 'Completed'
        });
      }
    });

    return list;
  }, [labWallets]);

  // Total Purchased Tokens from live summary or Payments
  const totalPurchasedTokens = useMemo(() => {
    if (summary && typeof summary.totalPurchased === 'number' && summary.totalPurchased > 0) {
      return summary.totalPurchased;
    }
    return successfulTransactions
      .filter(t => t.type === 'Credit' || (t.type as string) === 'Token' || !t.type)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 120;
  }, [summary, successfulTransactions]);

  // Real Available Tokens from live summary or Auth/Wallet
  const availableTokens = useMemo(() => {
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

  // Real Tokens Consumed from live summary or practice records
  const tokensSpent = useMemo(() => {
    if (summary && typeof summary.totalUsed === 'number') {
      return summary.totalUsed;
    }
    return Math.max(0, totalPurchasedTokens - availableTokens);
  }, [summary, totalPurchasedTokens, availableTokens]);

  const progressValue =
    totalPurchasedTokens > 0
      ? Math.min(100, (tokensSpent / totalPurchasedTokens) * 100)
      : 0;

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col rounded-xl p-6 bg-white dark:bg-card">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Token Wallet Summary
          </h3>
          <p className="text-xs text-muted-foreground">Manage your lab tokens and transactions</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
            onClick={() => {
              setSelectedLabId(undefined);
              setBuyModalOpen(true);
            }}
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            Buy Tokens
          </Button>
          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
            {availableTokens}
          </span>

          <p className="text-sm font-medium text-slate-500 mt-1">
            Tokens Available
          </p>
        </div>

        <div className="text-right">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {tokensSpent} / {totalPurchasedTokens}
          </span>

          <p className="text-xs font-medium text-slate-500">
            Used / Purchased
          </p>
        </div>
      </div>

      <Progress
        value={progressValue}
        className="h-3 bg-slate-100 dark:bg-slate-800 mb-8 rounded-full"
      />

      <div className="mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setActiveTab('consumed')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'consumed'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Lab Tokens Consumed ({combinedUsageList.length})
            </button>
            <button
              onClick={() => setActiveTab('topups')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'topups'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Top-Up Purchases ({successfulTransactions.length})
            </button>
          </div>

          <Link
            to="/student/transactions"
            className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline"
          >
            History & Receipts &rarr;
          </Link>
        </div>

        {activeTab === 'consumed' ? (
          combinedUsageList.length > 0 ? (
            <div className="space-y-3">
              {combinedUsageList.slice(0, 5).map((u, idx) => (
                <div
                  key={u.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 flex items-center justify-center shrink-0">
                      <ArrowDownRight className="h-4 w-4 text-rose-500" />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {u.labName} Practice Session
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                        <span>{u.minutesUsed} mins runtime</span>
                        <span>&bull;</span>
                        <span>{new Date(u.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                      -{u.creditsConsumed || u.tokensConsumed} Tokens
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      Consumed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground font-medium rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No lab practice tokens consumed yet
            </div>
          )
        ) : (
          successfulTransactions.length > 0 ? (
            <div className="space-y-3">
              {successfulTransactions.slice(0, 4).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 flex items-center justify-center shrink-0">
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {tx.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                        <span>{tx.id}</span>
                        <span>&bull;</span>
                        <span>{tx.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                      +₹{tx.amountRupees ?? tx.amount}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      +{tx.amount} Tokens
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground font-medium rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No successful token top-ups logged yet
            </div>
          )
        )}
      </div>

      <TokenPackagesModal
        open={buyModalOpen}
        onOpenChange={setBuyModalOpen}
        targetLabId={selectedLabId}
      />
    </Card>
  );
}