import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  GraduationCap,
  FlaskConical,
  ShieldCheck,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useTransactionStore } from '@/stores/transactionStore';
import { useLabCreditUsageStore } from '@/stores/labCreditUsageStore';
import { useLabTokenStore } from '@/stores/labTokenStore';
import { isUniversityStudent } from '@/lib/student-kind';
import { getSemesterCourseListByProgrammeId, getStudentPurchasedProgrammes } from '@/Utils/lmsApi_paths';
import { Link } from '@tanstack/react-router';

export function CreditWalletSummary() {
  const { auth } = useAuthStore();
  const { user } = auth;
  const { summary, labWallets, courseAllocations, isUniversityStudent: storeIsUni, universityName: storeUniName, fetchStudentLabTokens } = useLabTokenStore();
  const { transactions: rawTransactions, fetchTransactions } = useTransactionStore();
  const { usageRecords } = useLabCreditUsageStore();

  const isUniversity = isUniversityStudent(user) || Boolean(storeIsUni);
  const universityName = storeUniName || user?.collegeName || user?.tenantName || user?.organization || 'University';

  const [lmsAllocations, setLmsAllocations] = useState<any[]>([]);

  useEffect(() => {
    fetchStudentLabTokens();
    fetchTransactions();
  }, [fetchStudentLabTokens, fetchTransactions]);

  // Fetch student's real university programme courses & practical token allocations
  useEffect(() => {
    if (!isUniversity) return;
    let cancelled = false;

    const fetchAllocations = async () => {
      let programIds: string[] = [];
      if (user?.programmesList && Array.isArray(user.programmesList)) {
        programIds = user.programmesList
          .map((p: any) => String(p.programmeId || p.programId || ''))
          .filter(Boolean);
      }
      const studentId = user?.studentId || user?.studentDegreeAdmissionId || user?.externalStudentId;
      if (programIds.length === 0 && studentId) {
        try {
          const res: any = await getStudentPurchasedProgrammes(studentId);
          const rawProgs = res?.programmeList || res?.rawData?.programmeList || [];
          programIds = rawProgs
            .map((p: any) => String(p.programmeId || p.programId || ''))
            .filter(Boolean);
        } catch (e) {}
      }

      programIds = Array.from(new Set(programIds));
      if (programIds.length === 0) return;

      const items: any[] = [];
      const seen = new Set<string>();

      await Promise.all(
        programIds.map(async (pid) => {
          try {
            const res: any = await getSemesterCourseListByProgrammeId(pid);
            const courses = res?.courseList || res?.courses || res?.rawData?.courseList || [];
            const sems = res?.semesterList || [];
            let all = [...courses];
            if (Array.isArray(sems)) {
              sems.forEach((s: any) => {
                if (Array.isArray(s?.courseList)) all.push(...s.courseList);
              });
            }

            all.forEach((c: any) => {
              const cCode = String(c.courseCode || c.code || c.subjectCode || '').trim();
              const cName = c.courseName || c.name || c.subjectName || cCode;
              const mapped = c.mappedLab || (c.labId ? { labId: c.labId, title: c.labTitle } : null);
              const practical = Number(c.practicalCredit || mapped?.practicalCredit || c.credits || 60);
              const rawLabId = String(mapped?.labId || c.labId || '').toLowerCase().trim();
              const cleanId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');

              let labTitle = mapped?.title || c.labTitle;
              if (!labTitle) {
                if (cleanId.includes('dbms')) labTitle = 'DBMS & SQL Lab';
                else if (cleanId.includes('dotnet')) labTitle = '.NET Technologies Lab';
                else if (cleanId.includes('python')) labTitle = 'Python Programming Lab';
                else if (cleanId.includes('java')) labTitle = 'Java Development Lab';
                else if (cleanId.includes('linux')) labTitle = 'Linux Administration Lab';
                else if (cleanId.includes('android')) labTitle = 'Android Application Lab';
                else labTitle = cleanId ? `${cleanId.toUpperCase()} Lab` : cName;
              }

              const key = cleanId || cCode;
              if (key && !seen.has(key)) {
                seen.add(key);
                items.push({
                  labId: cleanId,
                  labTitle,
                  courseName: cName,
                  courseCode: cCode,
                  semester: c.semesterId || c.semesterNumber,
                  allocatedTokens: practical,
                });
              }
            });
          } catch (e) {}
        })
      );

      if (!cancelled && items.length > 0) {
        setLmsAllocations(items);
      }
    };

    fetchAllocations();
    return () => {
      cancelled = true;
    };
  }, [isUniversity, user?.programmesList, user?.studentId, user?.studentDegreeAdmissionId, user?.externalStudentId]);

  // Combine real database wallets with university course allocations
  const universityAllocations = useMemo(() => {
    const list: any[] = [];
    const sourceAllocations = (courseAllocations && courseAllocations.length > 0)
      ? courseAllocations
      : lmsAllocations;

    sourceAllocations.forEach((item: any) => {
      const cleanId = String(item.labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
      list.push({
        ...item,
        labId: cleanId,
      });
    });

    // Also include any labWallets that have records (e.g. DBMS, .NET)
    (labWallets || []).forEach((w) => {
      const cleanId = String(w.labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
      const existing = list.find((item) => item.labId === cleanId);
      if (!existing) {
        let labTitle = 'Virtual Lab';
        if (cleanId.includes('dbms')) labTitle = 'DBMS & SQL Lab';
        else if (cleanId.includes('dotnet')) labTitle = '.NET Technologies Lab';
        else if (cleanId.includes('python')) labTitle = 'Python Programming Lab';
        else if (cleanId.includes('java')) labTitle = 'Java Development Lab';
        else if (cleanId.includes('linux')) labTitle = 'Linux Administration Lab';
        else if (cleanId.includes('android')) labTitle = 'Android Application Lab';
        else labTitle = `${w.labId.toUpperCase()} Lab`;

        list.push({
          labId: cleanId,
          labTitle,
          courseName: `${labTitle} Practice Course`,
          courseCode: cleanId.toUpperCase(),
          allocatedTokens: Number(w.purchasedTokens || w.usedTokens || 60),
        });
      }
    });

    return list.map((item) => {
      const matchedWallet = (labWallets || []).find((w) => {
        const wId = String(w.labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
        return wId === item.labId;
      });
      const used = matchedWallet ? Number(matchedWallet.usedTokens || 0) : 0;
      const allocated = matchedWallet && Number(matchedWallet.purchasedTokens || 0) > Number(item.allocatedTokens || 0)
        ? Number(matchedWallet.purchasedTokens)
        : Number(item.allocatedTokens || 60);
      const remaining = matchedWallet
        ? Number(matchedWallet.remainingTokens ?? Math.max(0, allocated - used))
        : allocated;

      return {
        ...item,
        allocatedTokens: allocated,
        usedTokens: used,
        remainingTokens: remaining,
      };
    });
  }, [courseAllocations, lmsAllocations, labWallets]);

  // Live transactions returned from backend are already scoped to this student
  const liveTransactions = rawTransactions || [];

  // Filter ONLY successful/completed transactions for dashboard summary list
  const successfulTransactions = useMemo(() => {
    return liveTransactions.filter((tx) => tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed'));
  }, [liveTransactions]);

  const [activeTab, setActiveTab] = useState<'consumed' | 'topups' | 'allocations'>('consumed');

  // Dynamic lab practice usage records from real-time database labWallets
  const combinedUsageList = useMemo(() => {
    const list: any[] = [];

    (labWallets || []).forEach((w) => {
      const used = Number(w.usedTokens || 0);
      if (used > 0) {
        const rawId = String(w.labId || '').toLowerCase().trim();
        const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');
        let labName = 'Virtual Lab';
        if (cleanId.includes('dbms')) labName = 'DBMS & SQL Lab';
        else if (cleanId.includes('python')) labName = 'Python Programming Lab';
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
          status: 'Completed',
        });
      }
    });

    return list;
  }, [labWallets]);

  // Total Real Tokens Allocated by University (or Purchased for Direct students)
  const totalAllocatedTokens = useMemo(() => {
    if (isUniversity) {
      if (universityAllocations.length > 0) {
        const sum = universityAllocations.reduce((acc, a) => acc + Number(a.allocatedTokens || 0), 0);
        if (sum > 0) return sum;
      }
      if (summary && typeof (summary as any).totalAllocated === 'number' && (summary as any).totalAllocated > 0) {
        return (summary as any).totalAllocated;
      }
      if (summary && typeof summary.totalPurchased === 'number' && summary.totalPurchased > 0) {
        return summary.totalPurchased;
      }
      return 180;
    }
    if (summary && typeof summary.totalPurchased === 'number' && summary.totalPurchased > 0) {
      return summary.totalPurchased;
    }
    return successfulTransactions
      .filter((t) => t.type === 'Credit' || (t.type as string) === 'Token' || !t.type)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 120;
  }, [isUniversity, universityAllocations, summary, successfulTransactions]);

  // Real Tokens Consumed from live summary or practice records
  const tokensSpent = useMemo(() => {
    if (summary && typeof summary.totalUsed === 'number' && summary.totalUsed > 0) {
      return summary.totalUsed;
    }
    const sumConsumed = combinedUsageList.reduce((acc, u) => acc + Number(u.tokensConsumed || 0), 0);
    if (sumConsumed > 0) return sumConsumed;
    return 0;
  }, [summary, combinedUsageList]);

  // Real Available Tokens from live summary or University Allocations
  const availableTokens = useMemo(() => {
    if (isUniversity && universityAllocations.length > 0) {
      const sum = universityAllocations.reduce((acc, a) => acc + Number(a.remainingTokens || 0), 0);
      return Math.max(0, Math.round(sum));
    }
    if (summary && typeof summary.totalRemaining === 'number') {
      return summary.totalRemaining;
    }
    if (typeof user?.tokens === 'number' && user.tokens > 0) {
      return Math.max(0, Math.round(user.tokens));
    }
    if (typeof user?.credits === 'number' && user.credits !== 1000 && user.credits > 0) {
      return Math.max(0, Math.round(user.credits));
    }
    return Math.max(0, totalAllocatedTokens - tokensSpent);
  }, [isUniversity, universityAllocations, summary, user, totalAllocatedTokens, tokensSpent]);

  const progressValue =
    totalAllocatedTokens > 0
      ? Math.min(100, (tokensSpent / totalAllocatedTokens) * 100)
      : 0;

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col rounded-xl p-6 bg-white dark:bg-card">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              {isUniversity ? 'University Token Wallet' : 'Token Wallet Summary'}
            </h3>
            {isUniversity && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-indigo-600" />
                University Allocated
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isUniversity
              ? `Assigned by ${universityName} for your enrolled course curriculum`
              : 'Manage your lab tokens and transactions'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isUniversity ? (
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              asChild
            >
              <Link to="/student/my-labs">
                <FlaskConical className="w-3.5 h-3.5 mr-1" />
                View My Labs
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              asChild
            >
              <Link to="/student/credit-wallet">
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                Buy Tokens
              </Link>
            </Button>
          )}

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
            {tokensSpent} / {totalAllocatedTokens}
          </span>

          <p className="text-xs font-medium text-slate-500">
            {isUniversity ? 'Used / Allocated' : 'Used / Purchased'}
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

            {isUniversity ? (
              <button
                onClick={() => setActiveTab('allocations')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'allocations'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                University Allocations ({universityAllocations.length})
              </button>
            ) : (
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
            )}
          </div>

          <Link
            to={isUniversity ? '/student/my-labs' : '/student/transactions'}
            className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline"
          >
            {isUniversity ? 'All Enrolled Labs \u2192' : 'History & Receipts \u2192'}
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
                        <span>
                          {new Date(u.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
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
        ) : activeTab === 'allocations' ? (
          universityAllocations.length > 0 ? (
            <div className="space-y-3">
              {universityAllocations.slice(0, 5).map((item, idx) => (
                <div
                  key={item.labId || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                          {item.labTitle}
                        </p>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          Assigned
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                        <span>{item.courseCode || item.courseName}</span>
                        {item.semester ? (
                          <>
                            <span>&bull;</span>
                            <span>Semester {item.semester}</span>
                          </>
                        ) : null}
                        <span>&bull;</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {item.remainingTokens} Available
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block">
                      +{item.allocatedTokens} Tokens
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      University Quota
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground font-medium rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No university lab allocations found for this student.
            </div>
          )
        ) : successfulTransactions.length > 0 ? (
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
        )}
      </div>
    </Card>
  );
}