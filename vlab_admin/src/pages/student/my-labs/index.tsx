import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { useLabStore } from '@/stores/labStore';
import { MyLabsHeader } from './components/my-labs-header';
import { ActiveLabs } from './components/active-labs';
import { LabCard } from './components/lab-card';
import { AlertCircle, Loader2, BookOpen, FlaskConical } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth-store';
import { useLabSessionStore } from '@/stores/labSessionStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { SessionTimeoutModal } from './components/session-timeout-modal';
import { TenMinuteWarningModal } from './components/ten-minute-warning-modal';
import { ExtendSessionModal } from './components/extend-session-modal';
import { PaymentGateway } from './components/payment-gateway';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DotnetSelectionModal } from './components/dotnet-selection-modal';
import { PurchaseCreditModal } from './components/purchase-credit-modal';
import { TokenPackagesModal } from './components/token-packages-modal';
import { useLabTokenStore } from '@/stores/labTokenStore';
import { getSemesterCourseListByProgrammeId, getStudentPurchasedProgrammes } from '@/Utils/lmsApi_paths';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function MyLabs() {
  const { labs, isLoading, error, loadLabs } = useLabStore();
  const { auth } = useAuthStore();
  const { user, updateUser } = auth;
  const { transactions, fetchTransactions, addTransaction } = useTransactionStore();
  const navigate = useNavigate();

  const searchParams = useSearch({ strict: false }) as { semester?: string; programId?: string };
  const hasCourseFilter = Boolean(searchParams.semester || searchParams.programId);
  const semesterFilterQuery = searchParams.semester || (hasCourseFilter ? '1' : '');
  const programIdQuery = searchParams.programId || (hasCourseFilter ? '1' : '');

  const { activeSession, startingLabId, stoppingLabId, elapsedTime, startError, loadActiveSession, startLab, stopLab, clearStartError } = useLabSessionStore();

  const [pendingStop, setPendingStop] = useState<{ sessionId: string, labId: string } | null>(null);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState<any>(null);
  const [showDirectPurchaseModal, setShowDirectPurchaseModal] = useState<any>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [showDotnetModal, setShowDotnetModal] = useState(false);
  const [selectedDotnetLabId, setSelectedDotnetLabId] = useState<string | null>(null);
  const { labWallets, fetchStudentLabTokens } = useLabTokenStore();
  const [tokenPackagesModalOpen, setTokenPackagesModalOpen] = useState(false);
  const [selectedTokenLabId, setSelectedTokenLabId] = useState<string | undefined>(undefined);
  const [selectedTokenLabTitle, setSelectedTokenLabTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchStudentLabTokens();
    fetchTransactions();
  }, [fetchStudentLabTokens, fetchTransactions]);

  const isDirectUser = useMemo(() => {
    if (!user) return false;
    if (user.createdFrom === 'DIRECT' || user.authType === 'DIRECT') return true;
    if (!user.programmesList || !Array.isArray(user.programmesList) || user.programmesList.length === 0) {
      if (!user.programName && !user.studentId && !(user as any).StudentDegreeAdmissionId) {
        return true;
      }
    }
    return false;
  }, [user]);

  // Dynamic Semester Courses & Mapped Labs State
  const [semesterCourses, setSemesterCourses] = useState<any[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);

  // Total Assigned Labs across all enrolled student programs
  const [allEnrolledMappedLabs, setAllEnrolledMappedLabs] = useState<any[]>([]);
  const [isEnrolledLabsLoading, setIsEnrolledLabsLoading] = useState(false);

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  useEffect(() => {
    if (!user?.userId && !user?.email) return;
    const userId = String(user.userId ?? user.email);
    loadActiveSession(userId);
  }, [user, loadActiveSession]);

  // Fetch Semester Courses & Mapped Labs dynamically from LMS API for selected semester
  useEffect(() => {
    if (!programIdQuery) {
      setSemesterCourses([]);
      return;
    }

    setIsCoursesLoading(true);
    getSemesterCourseListByProgrammeId(programIdQuery)
      .then((res: any) => {
        const rawData = res?.rawData || res;
        const semList = res?.semesterList || rawData?.semesterList || rawData?.semesterCourseList || [];
        const allCourses = res?.courseList || res?.courses || rawData?.courseList || rawData?.courselist || [];

        let courses: any[] = [];

        if (allCourses && allCourses.length > 0) {
          const matchedSem = semList.find((s: any) =>
            String(s.semesterNumber) === String(semesterFilterQuery) ||
            String(s.semesterId) === String(semesterFilterQuery)
          );

          const targetSemId = matchedSem ? String(matchedSem.semesterId || matchedSem.semesterNumber) : null;

          courses = allCourses.filter((c: any) => {
            const cSemId = String(c.semesterId || c.semesterNumber || '');
            const cSemNum = String(c.semesterNumber || c.semesterId || '');
            return (
              (targetSemId && cSemId === targetSemId) ||
              cSemNum === String(semesterFilterQuery) ||
              cSemId === String(semesterFilterQuery)
            );
          });

          if (courses.length === 0) {
            courses = allCourses;
          }
        } else if (semList && semList.length > 0) {
          const matchedSem = semList.find((s: any) =>
            String(s.semesterNumber) === String(semesterFilterQuery) ||
            String(s.semesterId) === String(semesterFilterQuery)
          );
          courses = matchedSem?.courseList || matchedSem?.courselist || semList[0]?.courseList || [];
        }

        setSemesterCourses(courses);
      })
      .catch(() => {
        setSemesterCourses([]);
      })
      .finally(() => {
        setIsCoursesLoading(false);
      });
  }, [programIdQuery, semesterFilterQuery]);

  // Fetch all assigned labs across all enrolled programs for general "My Labs" view (LMS Students only)
  useEffect(() => {
    if (!user) return;
    if (isDirectUser) {
      setAllEnrolledMappedLabs([]);
      setIsEnrolledLabsLoading(false);
      return;
    }

    const studentId = user.studentId || (user as any).StudentDegreeAdmissionId || (user as any).externalStudentId || user.userId;

    setIsEnrolledLabsLoading(true);

    const loadEnrolledLabs = async () => {
      let programIds: string[] = [];

      if (user.programmesList && Array.isArray(user.programmesList) && user.programmesList.length > 0) {
        programIds = user.programmesList
          .map((p: any) => String(p.programmeId || p.programId || ''))
          .filter(Boolean);
      }

      if (programIds.length === 0 && studentId) {
        try {
          const res: any = await getStudentPurchasedProgrammes(studentId);
          const rawProgs = res?.programmeList || res?.rawData?.programmeList || [];
          programIds = rawProgs
            .map((p: any) => String(p.programmeId || p.programId || ''))
            .filter(Boolean);
        } catch (e) {
          console.warn("Failed to fetch purchased programmes:", e);
        }
      }

      if (programIds.length === 0) {
        programIds = ['1', '2', '18'];
      }

      programIds = Array.from(new Set(programIds));

      const allMapped: any[] = [];
      const seenLabKeys = new Set<string>();

      await Promise.all(
        programIds.map(async (pid) => {
          try {
            const res: any = await getSemesterCourseListByProgrammeId(pid);
            const allCourses = res?.courseList || res?.courses || res?.rawData?.courseList || res?.rawData?.courselist || [];
            const semList = res?.semesterList || res?.rawData?.semesterList || [];

            let coursesToProcess: any[] = [...allCourses];
            if (semList && Array.isArray(semList)) {
              semList.forEach((s: any) => {
                const sCourses = s?.courseList || s?.courselist || [];
                coursesToProcess.push(...sCourses);
              });
            }

            coursesToProcess.forEach((c: any, idx: number) => {
              const cCode = String(c.courseCode || c.code || c.subjectCode || `CRS-${idx + 1}`);
              const cName = c.courseName || c.name || c.subjectName || `Course ${cCode}`;
              const mappedLabObj = c.mappedLab || (c.labId ? { labId: c.labId, title: c.labTitle } : null);

              if (mappedLabObj && (mappedLabObj.labId || mappedLabObj.LabId)) {
                const mId = String(mappedLabObj.labId || mappedLabObj.LabId);
                const uniqueKey = `${mId}-${cCode}`;

                if (!seenLabKeys.has(uniqueKey)) {
                  seenLabKeys.add(uniqueKey);

                  const labMatch = labs.find((l) => {
                    const lId = String(l.id || l.labId || l.LabId || '');
                    return lId === mId || lId.replace('lab-', '') === mId.replace('lab-', '');
                  });

                  if (labMatch) {
                    allMapped.push({
                      ...labMatch,
                      title: cName,
                      mappedLabTitle: mappedLabObj.title || labMatch.title,
                      courseCode: cCode,
                      courseName: cName,
                    });
                  } else {
                    allMapped.push({
                      id: mId,
                      title: cName,
                      subtitle: mappedLabObj.title || 'Course Assigned Lab',
                      category: 'Course Lab',
                      durationMinutes: mappedLabObj.durationMinutes || 90,
                      credits: mappedLabObj.credits || 30,
                      status: 'active',
                      courseCode: cCode,
                      courseName: cName,
                      mappedLabTitle: mappedLabObj.title,
                    });
                  }
                }
              }
            });
          } catch (e) {
            console.warn(`Failed to load courses for program ${pid}:`, e);
          }
        })
      );

      setAllEnrolledMappedLabs(allMapped);
      setIsEnrolledLabsLoading(false);
    };

    loadEnrolledLabs();
  }, [user?.userId, labs.length, isDirectUser]);

  // 1. Check Active Session on mount
  useEffect(() => {
    if (!user?.userId && !user?.email) return;
    const userId = String(user.userId ?? user.email);
    loadActiveSession(userId);
  }, [user, loadActiveSession]);

  // 3. Live Credit Deduction
  useEffect(() => {
    if (!user) return;
    if (!activeSession || activeSession.status !== 'running' || !activeSession.startedAt) return;

    const deductionInterval = setInterval(() => {
      const lab = labs.find(l => l.id === activeSession.labId);
      if (lab && (lab.credits || 0) > 0 && (lab.duration || lab.durationMinutes || 0) > 0) {
        const costPerMinute = (lab.credits || 0) / (lab.duration || lab.durationMinutes || 60);
        updateUser({
          credits: Math.max(0, (user.credits || 0) - costPerMinute)
        });
      }
    }, 60000);
    return () => clearInterval(deductionInterval);
  }, [user, activeSession, labs, updateUser]);

  const isLabActive = (lab: any) => {
    if (!activeSession?.labId) return false;
    const sLabId = String(activeSession.labId).toLowerCase().replace(/-lab$/, '');
    const lId = String(lab.id || lab.labId || '').toLowerCase().replace(/-lab$/, '');
    const lTitle = String(lab.title || lab.name || '').toLowerCase();
    return sLabId === lId || sLabId === lTitle || activeSession.labId === lab.id;
  };

  // Derived state for active labs
  const activeLabs = useMemo(() => {
    return labs.filter(isLabActive);
  }, [labs, activeSession]);

  // Extract any additional labs the student explicitly purchased credits for (not assigned to enrolled programs)
  const purchasedLabsList = useMemo(() => {
    const seenKeys = new Set<string>();
    const result: any[] = [];

    (transactions || []).forEach((tx) => {
      const isCompleted = tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed');
      if (isCompleted && tx.type === 'Credit') {
        const tLabId = tx.labId ? String(tx.labId).toLowerCase() : '';
        const tLabName = tx.labName ? String(tx.labName).toLowerCase() : '';

        if (tLabId || tLabName) {
          const match = labs.find((l) => {
            const lId = String(l.id || l.labId || l.LabId || '').toLowerCase();
            const lTitle = String(l.title || l.name || '').toLowerCase();
            return (
              (tLabId && (lId === tLabId || lId.replace('lab-', '') === tLabId.replace('lab-', ''))) ||
              (tLabName && lTitle.includes(tLabName))
            );
          });

          if (match) {
            const key = String(match.id || match.labId || match.title).toLowerCase();
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              result.push({
                ...match,
                subtitle: 'Purchased Lab Access',
                category: match.category || 'Purchased Lab',
              });
            }
          } else if (tx.labName) {
            const key = String(tx.labId || tx.labName).toLowerCase();
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              result.push({
                id: tx.labId || `purchased-${Date.now()}`,
                title: tx.labName,
                subtitle: 'Purchased Lab Access',
                category: 'Purchased Lab',
                durationMinutes: 90,
                credits: tx.amount || 50,
                status: 'active',
              });
            }
          }
        }
      }
    });

    return result;
  }, [transactions, labs]);

  const displayLabs = useMemo(() => {
    const currentStudentEmail = user?.email?.toLowerCase();

    // Map of lab IDs specifically purchased by the student
    const purchasedLabNames = new Set<string>();
    const purchasedLabIds = new Set<string>();

    (transactions || []).forEach(tx => {
      const isSuccess = tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed');
      if (isSuccess && tx.type === 'Credit') {
        const isOwner = !currentStudentEmail || !tx.studentEmail || tx.studentEmail.toLowerCase() === currentStudentEmail;
        if (isOwner) {
          if (tx.labId) {
            String(tx.labId).toLowerCase().split(',').forEach(id => {
              const cleanId = id.trim();
              if (cleanId) purchasedLabIds.add(cleanId);
            });
          }
          if (tx.labName) purchasedLabNames.add(String(tx.labName).toLowerCase());
          if (tx.description) purchasedLabNames.add(String(tx.description).toLowerCase());
        }
      }
    });

    const enrolledUniversityLabIds = new Set(
      allEnrolledMappedLabs.map(l => String(l.id || l.labId || l.LabId || l.title || '').toLowerCase())
    );

    const tagLabWithAccess = (labItem: any) => {
      const lId = String(labItem.id || labItem.labId || labItem.LabId || '').toLowerCase();
      const lTitle = String(labItem.title || labItem.name || '').toLowerCase();

      const isPurchased = purchasedLabIds.has(lId) ||
        purchasedLabIds.has(lId.replace('lab-', '')) ||
        Array.from(purchasedLabNames).some(name => (lTitle && name && (lTitle.includes(name) || name.includes(lTitle))));

      const isUniversity = !isDirectUser && (
        enrolledUniversityLabIds.has(lId) ||
        enrolledUniversityLabIds.has(lTitle) ||
        hasCourseFilter ||
        Boolean(labItem.courseCode)
      );

      let accessType: 'personal' | 'university' | 'catalogue' = 'catalogue';
      let accessLabel = '';

      if (isPurchased) {
        accessType = 'personal';
        accessLabel = 'Personal';
      } else if (isUniversity) {
        accessType = 'university';
        accessLabel = 'UNI';
      }

      return {
        ...labItem,
        accessType,
        accessLabel,
        isPurchased,
        isUniversity,
      };
    };

    if (hasCourseFilter) {
      const mappedResults: any[] = [];

      (semesterCourses || []).forEach((c: any, idx: number) => {
        const cCode = String(c.courseCode || c.code || c.subjectCode || `CRS-${idx + 1}`);
        const cName = c.courseName || c.name || c.subjectName || `Course ${cCode}`;
        const mappedLabObj = c.mappedLab || (c.labId ? { labId: c.labId, title: c.labTitle } : null);

        if (mappedLabObj && (mappedLabObj.labId || mappedLabObj.LabId)) {
          const mId = String(mappedLabObj.labId || mappedLabObj.LabId);
          const labMatch = labs.find((l) => {
            const lId = String(l.id || l.labId || l.LabId || '');
            return lId === mId || lId.replace('lab-', '') === mId.replace('lab-', '');
          });

          if (labMatch) {
            mappedResults.push({
              ...labMatch,
              title: cName,
              mappedLabTitle: mappedLabObj.title || labMatch.title,
              courseCode: cCode,
              courseName: cName,
            });
          } else {
            mappedResults.push({
              id: mId,
              title: cName,
              subtitle: mappedLabObj.title || 'Course Assigned Lab',
              category: 'Course Lab',
              durationMinutes: mappedLabObj.durationMinutes || 90,
              credits: mappedLabObj.credits || 30,
              status: 'active',
              courseCode: cCode,
              courseName: cName,
              mappedLabTitle: mappedLabObj.title,
            });
          }
        }
      });

      return mappedResults.map(tagLabWithAccess);
    }

    // Direct Student view: show ALL virtual labs from system catalog tagged with access!
    if (isDirectUser) {
      return labs.map(tagLabWithAccess);
    }

    // Main My Labs page view for LMS Students:
    // Combine assigned labs for enrolled programs + any extra labs purchased by the student!
    const combined: any[] = [...allEnrolledMappedLabs];
    const existingIds = new Set(
      allEnrolledMappedLabs.map((l) => String(l.id || l.labId || l.title || '').toLowerCase())
    );

    purchasedLabsList.forEach((pLab) => {
      const pId = String(pLab.id || pLab.labId || pLab.title || '').toLowerCase();
      if (!existingIds.has(pId)) {
        existingIds.add(pId);
        combined.push(pLab);
      }
    });

    return combined.map(tagLabWithAccess);
  }, [labs, isDirectUser, hasCourseFilter, semesterCourses, allEnrolledMappedLabs, purchasedLabsList, transactions, user]);

  // Split displayLabs into purchased/unlocked labs vs available/unpurchased catalogue labs
  const { purchasedLabs, otherLabs } = useMemo(() => {
    const purchased: any[] = [];
    const other: any[] = [];

    (displayLabs || []).forEach((lab: any) => {
      if (lab.isPurchased || lab.accessType === 'personal' || lab.isUniversity || lab.accessType === 'university') {
        purchased.push(lab);
      } else {
        other.push(lab);
      }
    });

    return { purchasedLabs: purchased, otherLabs: other };
  }, [displayLabs]);

  const getLabId = (lab: any) => lab?.id || lab?.labId || lab?.LabId || lab?.labCode || lab?.LabCode || lab?._id || '';

  const handleStartLab = async (labId: string) => {
    if (!labId) {
      toast.error('Cannot start lab: labId is missing or invalid');
      return;
    }

    if (!user) {
      toast.error('Please sign in to start a lab session');
      navigate({ to: '/sign-in' });
      return;
    }

    const lab = labs.find(l => getLabId(l) === labId) || displayLabs.find(l => getLabId(l) === labId);
    if (!lab) return;

    clearStartError();

    const isAdmin = user.role?.includes('Super Admin') || user.role?.includes('Tenant Admin');
    const labCost = Number(lab.credits || lab.creditCost || 30);
    const currentStudentEmail = user?.email?.toLowerCase();

    // Calculate credits specifically purchased for THIS lab
    const specificLabCredits = (transactions || []).reduce((sum, tx) => {
      const isSuccess = tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed');
      if (!isSuccess || tx.type !== 'Credit') return sum;
      const isOwner = !currentStudentEmail || !tx.studentEmail || tx.studentEmail.toLowerCase() === currentStudentEmail;
      if (!isOwner) return sum;

      const tLabIds = String(tx.labId || '').toLowerCase().split(',').map(s => s.trim());
      const tLabName = String(tx.labName || tx.description || '').toLowerCase();
      const currLabId = String(getLabId(lab)).toLowerCase();
      const currLabTitle = String(lab.title || lab.name || '').toLowerCase();

      const isMatch = (
        tLabIds.some(id => id === currLabId || id.replace('lab-', '') === currLabId.replace('lab-', '')) ||
        (tLabName && currLabTitle && (tLabName.includes(currLabTitle) || currLabTitle.includes(tLabName)))
      );

      return isMatch ? sum + (Number(tx.amount) || 0) : sum;
    }, 0);

    // Also check if assigned via enrolled LMS curriculum (for university/institution students)
    const isEnrolledInCurriculum = !isDirectUser && (
      allEnrolledMappedLabs.some((l: any) => (l.id || l.labId || l.LabId) === labId || (l.id || l.labId || l.LabId) === getLabId(lab)) ||
      (semesterCourses && semesterCourses.some((c: any) => c.labId === labId || c.labCode === labId))
    );

    // Check lab-specific token wallet balance
    const targetCleanId = String(getLabId(lab) || labId).toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
    const labWallet = (labWallets || []).find((w) => {
      const wId = String(w.labId).toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
      return wId === targetCleanId;
    });
    const remainingTokens = labWallet ? Number(labWallet.remainingTokens || 0) : 0;

    const canStartLab = isAdmin || remainingTokens > 0 || specificLabCredits > 0 || isEnrolledInCurriculum;

    if (!canStartLab) {
      setSelectedTokenLabId(labId);
      setSelectedTokenLabTitle(lab.title || lab.name || labId);
      setTokenPackagesModalOpen(true);
      toast.info(`Please purchase tokens for ${lab.title || labId} to start practice.`);
      return;
    }

    if (activeSession && activeSession.labId !== labId) {
      setShowWarningModal(true);
      return;
    }

    const isDotnet = labId.toLowerCase().includes('dotnet') ||
      lab.category?.toLowerCase().includes('dotnet') ||
      lab.title?.toLowerCase().includes('.net');

    if (isDotnet) {
      setSelectedDotnetLabId(labId);
      setShowDotnetModal(true);
      return;
    }

    const academicCtx = {
      programId: programIdQuery,
      semesterId: semesterFilterQuery,
      courseCode: (lab as any).courseCode
    };

    const creditBalance = specificLabCredits || (typeof user.credits === 'number' && user.credits > 0 ? user.credits : 167);
    const session = await startLab(labId, 1, undefined, academicCtx, creditBalance);
    if (session?.sessionId) {
      navigate({ to: `/admin/compute/rdp`, search: { labId, sessionId: session.sessionId } });
    }
  };

  const handleConfirmDotnetLab = async (subtype: 'console' | 'mvc') => {
    setShowDotnetModal(false);
    const labId = selectedDotnetLabId;
    if (!labId) return;
    setSelectedDotnetLabId(null);

    const lab = labs.find(l => getLabId(l) === labId) || displayLabs.find(l => getLabId(l) === labId);
    const academicCtx = {
      programId: programIdQuery,
      semesterId: semesterFilterQuery,
      courseCode: (lab as any)?.courseCode
    };

    const creditBalance = typeof user?.credits === 'number' && user.credits > 0 ? user.credits : 167;
    const session = await startLab(labId, 1, subtype, academicCtx, creditBalance);
    if (session?.sessionId) {
      navigate({ to: `/admin/compute/rdp`, search: { labId, sessionId: session.sessionId } });
    }
  };

  const handleStopLabConfirm = async () => {
    if (!pendingStop) return;
    const { sessionId, labId } = pendingStop;
    setShowStopModal(false);

    try {
      await stopLab(sessionId, labId);
      await loadActiveSession();
      await fetchStudentLabTokens();
      await fetchTransactions();
    } catch (err) {
      console.error('Failed to stop lab:', err);
    } finally {
      setPendingStop(null);
    }
  };

  const handleStopLabClick = (labId: string) => {
    if (activeSession) {
      const targetSessionId = activeSession.sessionId || (activeSession as any).SessionId;
      const targetLabId = activeSession.labId || labId;
      if (targetSessionId) {
        setPendingStop({ sessionId: targetSessionId, labId: targetLabId });
        setShowStopModal(true);
      }
    }
  };

  const handleResumeLab = (labId: string) => {
    if (activeSession) {
      const targetSessionId = activeSession.sessionId || (activeSession as any).SessionId;
      const targetLabId = activeSession.labId || labId;
      if (targetSessionId) {
        navigate({ to: `/admin/compute/rdp`, search: { labId: targetLabId, sessionId: targetSessionId } });
      }
    } else {
      console.log('No active session found locally to resume.');
    }
  };

  const handleViewDetails = (id: string) => {
    console.log('View details', id);
  };

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Student Portal</span>
            <span className="text-border">/</span>
            <span className="text-red-500 font-semibold">
              {semesterFilterQuery ? `Semester ${semesterFilterQuery} Course Labs` : 'My Labs'}
            </span>
          </div>
        </div>
      </Header>

      <Main className="bg-[#f8fafc] dark:bg-background min-h-[calc(100vh-4rem)]">
        <div className="w-full px-4 md:px-6 xl:px-10 py-6 space-y-6 max-w-[1600px] mx-auto">

          {hasCourseFilter ? (
            <div className="mb-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">
                <FlaskConical className="h-4 w-4" />
                <span>Course Practical Labs</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <span>Semester {semesterFilterQuery || '1'} Labs</span>
                <Badge variant="outline" className="text-xs font-semibold bg-red-50 text-red-700 border-red-200">
                  {displayLabs.length} Course Lab(s)
                </Badge>
              </h1>
              <p className="text-slate-500 text-sm mt-1.5 max-w-2xl">
                Practical virtual lab environments assigned to your academic courses for Semester {semesterFilterQuery || '1'}.
              </p>
            </div>
          ) : (
            <MyLabsHeader labs={displayLabs} activeSession={activeSession} user={user} />
          )}

          {startError && (
            <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-900/50 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Start Error</AlertTitle>
              <AlertDescription>{startError}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-900/50 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {(isLoading || isCoursesLoading || isEnrolledLabsLoading) && displayLabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
              <p className="text-muted-foreground font-medium">Loading your assigned course labs...</p>
            </div>
          ) : (
            <>
              {/* Only show active labs section if not filtering by semester, and if there are running sessions */}
              {!hasCourseFilter && activeLabs.length > 0 && (
                <ActiveLabs labs={activeLabs} onResume={handleResumeLab} />
              )}

              <div className="mt-6">
                {isDirectUser && !hasCourseFilter ? (
                  // Direct External Student: Cleanly divided into Purchased Labs (Top) and Available Labs (Bottom)
                  <div className="space-y-10">
                    {/* Section 1: Purchased Labs */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <div>
                          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Purchased Labs
                            <Badge variant="outline" className="text-xs font-semibold bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                              {purchasedLabs.length}
                            </Badge>
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Virtual laboratories with active credit balance ready to start.
                          </p>
                        </div>
                      </div>

                      {purchasedLabs.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
                          {purchasedLabs.map((lab: any) => (
                            <LabCard
                              key={lab.id}
                              lab={lab}
                              onStart={handleStartLab}
                              onResume={handleResumeLab}
                              onStop={handleStopLabClick}
                              onDetails={handleViewDetails}
                              activeSession={isLabActive(lab) ? activeSession : undefined}
                              elapsedTime={isLabActive(lab) ? elapsedTime || undefined : undefined}
                              isStarting={startingLabId === lab.id}
                              isStopping={stoppingLabId === lab.id}
                              userCredits={user?.credits}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 bg-white dark:bg-card rounded-xl border border-dashed border-border/60 text-center px-4">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Purchased Labs</p>
                          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                            You have not purchased credits for any labs yet. Select any lab from the catalogue below to begin.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Section 2: Unpurchased / Available Catalogue Labs */}
                    {otherLabs.length > 0 && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between pb-2 border-b border-border/40">
                          <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              Available Lab Catalogue
                              <Badge variant="outline" className="text-xs font-semibold bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                {otherLabs.length}
                              </Badge>
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Select a virtual laboratory to purchase credits and launch your workspace.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
                          {otherLabs.map((lab: any) => (
                            <LabCard
                              key={lab.id}
                              lab={lab}
                              onStart={handleStartLab}
                              onResume={handleResumeLab}
                              onStop={handleStopLabClick}
                              onDetails={handleViewDetails}
                              activeSession={isLabActive(lab) ? activeSession : undefined}
                              elapsedTime={isLabActive(lab) ? elapsedTime || undefined : undefined}
                              isStarting={startingLabId === lab.id}
                              isStopping={stoppingLabId === lab.id}
                              userCredits={user?.credits}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // University LMS Student (or Semester Filter View): Standard unified grid
                  displayLabs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-xl border border-dashed border-border/60">
                      <BookOpen className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                      <h3 className="text-lg font-bold text-foreground">No Course Labs Found</h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        No practical courses were found for Semester {semesterFilterQuery}.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
                      {displayLabs.map((lab: any) => (
                        <LabCard
                          key={lab.id}
                          lab={lab}
                          onStart={handleStartLab}
                          onResume={handleResumeLab}
                          onStop={handleStopLabClick}
                          onDetails={handleViewDetails}
                          activeSession={isLabActive(lab) ? activeSession : undefined}
                          elapsedTime={isLabActive(lab) ? elapsedTime || undefined : undefined}
                          isStarting={startingLabId === lab.id}
                          isStopping={stoppingLabId === lab.id}
                          userCredits={user?.credits}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </Main>

      {/* Warning Modal */}
      <ConfirmDialog
        open={showWarningModal}
        onOpenChange={setShowWarningModal}
        handleConfirm={() => setShowWarningModal(false)}
        title="Active Session Found"
        desc="You already have an active lab session. Please stop the current lab before starting a new one."
        confirmText="OK"
        cancelBtnText="Close"
      />

      {/* Stop Modal */}
      <ConfirmDialog
        open={showStopModal}
        onOpenChange={setShowStopModal}
        handleConfirm={handleStopLabConfirm}
        title="Stop Lab Session?"
        desc="Are you sure you want to stop this lab? This action will terminate the running environment."
        confirmText="Stop Lab"
        cancelBtnText="Cancel"
      />

      {/* Timeout Modal */}
      <SessionTimeoutModal
        session={activeSession}
      />

      {/* Dotnet Project Selection Modal */}
      <DotnetSelectionModal
        open={showDotnetModal}
        onOpenChange={setShowDotnetModal}
        onConfirm={handleConfirmDotnetLab}
      />

      {/* Purchase Credit Requirement Modal */}
      <PurchaseCreditModal
        open={Boolean(showDirectPurchaseModal)}
        onOpenChange={(open) => !open && setShowDirectPurchaseModal(null)}
        lab={showDirectPurchaseModal}
        userCredits={showDirectPurchaseModal?.userLabCredits ?? 0}
        onPurchase={() => {
          setShowDirectPurchaseModal(null);
          navigate({ to: '/student/credit-wallet' });
        }}
      />

      <TenMinuteWarningModal />
      <ExtendSessionModal
        walletBalance={user?.credits ?? 0}
        onPurchaseCredits={() => navigate({ to: '/student/credit-wallet' })}
      />

      <TokenPackagesModal
        open={tokenPackagesModalOpen}
        onOpenChange={setTokenPackagesModalOpen}
        targetLabId={selectedTokenLabId}
        labTitle={selectedTokenLabTitle}
      />
    </>
  );
}
