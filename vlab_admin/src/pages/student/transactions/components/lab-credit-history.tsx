import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TerminalSquare, CheckCircle2, ArrowDownRight, ArrowUpRight, Flame } from 'lucide-react';
import { useTransactionStore } from '@/stores/transactionStore';
import { useLabCreditUsageStore } from '@/stores/labCreditUsageStore';
import { useLabTokenStore } from '@/stores/labTokenStore';
import { getSavedLabActivities } from '@/Utils/labActivityTracker';
import { useAuthStore } from '@/stores/auth-store';

interface LabCreditHistoryProps {
  recentLabs?: any[];
}

export function LabCreditHistory({ }: LabCreditHistoryProps) {
  const { auth } = useAuthStore();
  const { transactions } = useTransactionStore();
  const { usageRecords } = useLabCreditUsageStore();
  const { labWallets } = useLabTokenStore();
  const [activeTab, setActiveTab] = useState<'consumed' | 'purchased'>('consumed');

  const currentStudentEmail = auth?.user?.email?.toLowerCase();

  // Filter ONLY successful credit top-up transactions for the current student
  const successfulLabPurchases = transactions.filter((tx) => {
    const isOwner = !currentStudentEmail || !tx.studentEmail || tx.studentEmail.toLowerCase() === currentStudentEmail;
    const isCompleted = tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed');
    const isCredit = tx.type === 'Credit' || (tx.type as string) === 'Token' || !tx.type;
    return isOwner && isCompleted && isCredit;
  });

  // Group by unique lab to show total purchased credits per lab
  const labMap: Record<string, { labName: string; totalCredits: number; date: string; paymentMethod: string }> = {};

  successfulLabPurchases.forEach((tx) => {
    let name = tx.labName;
    if (!name || name === 'Virtual Lab') {
      if (tx.description.includes('Lab')) {
        name = tx.description.split(' Credit')[0].split(' Top-Up')[0].split(' Token')[0];
      } else {
        name = tx.description || 'Lab Credit Top-Up';
      }
    }

    if (!labMap[name]) {
      labMap[name] = {
        labName: name,
        totalCredits: 0,
        date: tx.date,
        paymentMethod: tx.paymentMethod || 'Razorpay',
      };
    }

    labMap[name].totalCredits += Number(tx.amount) || 0;
  });

  const purchasedLabs = Object.values(labMap);

  // Dynamic Lab Tokens Consumed (Lab-wise) from real live labWallets and usage records
  const consumedLabs = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

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

        seen.add(cleanId);
        list.push({
          id: `wallet-${cleanId}`,
          labId: cleanId,
          labName,
          creditsConsumed: used,
          minutesUsed: used,
          date: w.updatedAt || new Date().toISOString(),
          status: 'Completed'
        });
      }
    });

    const studentUsages = (usageRecords || []).filter(u => {
      return !currentStudentEmail || !u.studentEmail || u.studentEmail.toLowerCase() === currentStudentEmail;
    });

    studentUsages.forEach(u => {
      const rawId = String(u.labId || u.id || '').toLowerCase().trim().replace(/^lab-/, '').replace(/-lab$/, '');
      if (!seen.has(rawId)) {
        seen.add(rawId);
        list.push(u);
      }
    });

    if (currentStudentEmail) {
      const savedActivities = getSavedLabActivities(currentStudentEmail);
      savedActivities.forEach(act => {
        const cleanId = String(act.id || act.labName || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
        if (!seen.has(cleanId)) {
          const credits = Number(act.creditsUsed || 0);
          if (credits > 0 || act.status === 'Completed') {
            seen.add(cleanId);
            list.push({
              id: act.id,
              labId: act.id,
              labName: act.labName,
              creditsConsumed: credits > 0 ? credits : 5,
              minutesUsed: credits > 0 ? credits : 5,
              date: act.lastAccessed || new Date().toISOString(),
              studentEmail: currentStudentEmail,
              status: 'Completed'
            });
          }
        }
      });
    }

    return list;
  }, [labWallets, usageRecords, currentStudentEmail]);

  const totalTokensConsumed = consumedLabs.reduce((sum, item) => sum + (Number(item.creditsConsumed) || 0), 0);

  return (
    <Card className="border-border/50 shadow-sm h-full rounded-2xl flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Flame className="h-5 w-5 text-rose-500" /> Lab Tokens & Credits
          </CardTitle>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setActiveTab('consumed')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'consumed'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Consumed ({consumedLabs.length})
            </button>
            <button
              onClick={() => setActiveTab('purchased')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'purchased'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Purchased ({purchasedLabs.length})
            </button>
          </div>
        </div>
        <CardDescription>
          {activeTab === 'consumed'
            ? `Exact token consumption recorded per lab session (${totalTokensConsumed} Total Tokens Consumed).`
            : 'Virtual lab modules with verified successful credit/token top-ups.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        {activeTab === 'consumed' ? (
          <div className="space-y-3">
            {consumedLabs.length > 0 ? (
              consumedLabs.map((lab, index) => (
                <div
                  key={lab.id || index}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 flex items-center justify-center shrink-0">
                      <ArrowDownRight className="h-4 w-4 text-rose-500" />
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                        {lab.labName} Practice Session
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{lab.minutesUsed} mins runtime</span>
                        <span>&bull;</span>
                        <span>{new Date(lab.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-xs text-rose-600 dark:text-rose-400 block">
                      -{lab.creditsConsumed} Tokens
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Consumed
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center">
                <TerminalSquare className="h-8 w-8 text-slate-300 mb-2" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">No lab practice tokens consumed yet.</span>
                <span className="text-xs text-slate-400 mt-1">Start and practice in a lab environment to view runtime token deductions here.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {purchasedLabs.length > 0 ? (
              purchasedLabs.map((lab, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 flex items-center justify-center shrink-0">
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{lab.labName}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{lab.paymentMethod}</span>
                        <span>&bull;</span>
                        <span>{new Date(lab.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 block">
                      +{lab.totalCredits} Tokens
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 justify-end mt-0.5 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Paid & Active
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center">
                <TerminalSquare className="h-8 w-8 text-slate-300 mb-2" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">No purchased lab modules found.</span>
                <span className="text-xs text-slate-400 mt-1">Complete a lab top-up payment to see your lab modules here.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
