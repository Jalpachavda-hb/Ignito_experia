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
import { SessionTimeoutModal } from './components/session-timeout-modal';
import { PaymentGateway } from './components/payment-gateway';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DotnetSelectionModal } from './components/dotnet-selection-modal';
import { getSemesterCourseListByProgrammeId } from '@/Utils/lmsApi_paths';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function MyLabs() {
  const { labs, isLoading, error, loadLabs } = useLabStore();
  const { auth } = useAuthStore();
  const { user, updateUser } = auth;
  const navigate = useNavigate();

  const searchParams = useSearch({ strict: false }) as { semester?: string; programId?: string };
  const semesterFilterQuery = searchParams.semester || '1';
  const programIdQuery = searchParams.programId || '2';

  const { activeSession, startingLabId, stoppingLabId, elapsedTime, startError, loadActiveSession, startLab, stopLab, clearStartError } = useLabSessionStore();

  const [pendingStop, setPendingStop] = useState<{ sessionId: string, labId: string } | null>(null);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState<any>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [showDotnetModal, setShowDotnetModal] = useState(false);
  const [selectedDotnetLabId, setSelectedDotnetLabId] = useState<string | null>(null);

  // Dynamic Semester Courses & Mapped Labs State
  const [semesterCourses, setSemesterCourses] = useState<any[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  // Fetch Semester Courses & Mapped Labs dynamically from LMS API
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

  // Derived state for active labs
  const activeLabs = useMemo(() => {
    return labs.filter(lab => activeSession?.labId === lab.id);
  }, [labs, activeSession]);

  const displayLabs = useMemo(() => {
    if (semesterFilterQuery && semesterCourses.length > 0) {
      return semesterCourses.map((c: any, idx: number) => {
        const cCode = String(c.courseCode || c.code || c.subjectCode || `CRS-${idx + 1}`);
        const cName = c.courseName || c.name || c.subjectName || `Course ${cCode}`;

        if (c.mappedLab && c.mappedLab.labId) {
          const mId = String(c.mappedLab.labId);
          const labMatch = labs.find((l) => {
            const lId = String(l.id || l.labId || l.LabId || '');
            return lId === mId || lId.replace('lab-', '') === mId.replace('lab-', '');
          });

          return labMatch
            ? { ...labMatch, title: cName, mappedLabTitle: c.mappedLab.title, courseCode: cCode, courseName: cName }
            : {
                id: c.mappedLab.labId,
                title: cName,
                subtitle: c.mappedLab.title || 'Course Assigned Lab',
                category: 'Course Lab',
                durationMinutes: c.mappedLab.durationMinutes || 90,
                credits: c.mappedLab.credits || 30,
                status: 'active',
                courseCode: cCode,
                courseName: cName,
                mappedLabTitle: c.mappedLab.title
              };
        } else {
          // Default standard Experia LabCard for course without explicit Admin lab mapping yet
          const catalogFallback = labs[idx % (labs.length || 1)] || {};
          return {
            id: catalogFallback.id || `lab-course-${cCode.toLowerCase()}`,
            title: cName,
            category: catalogFallback.category || 'Practical Lab Workspace',
            durationMinutes: catalogFallback.durationMinutes || 90,
            credits: catalogFallback.credits || 30,
            status: 'active',
            courseCode: cCode,
            courseName: cName,
            logo: catalogFallback.logo || null
          };
        }
      });
    }

    return labs;
  }, [labs, semesterFilterQuery, semesterCourses]);

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
    const userCredits = Number(user.credits ?? 0);
    const labCost = Number(lab.credits ?? 0);

    if (!isAdmin && labCost > 0 && userCredits < labCost) {
      setShowCreditModal(lab);
      setIsPaymentOpen(true);
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

    const session = await startLab(labId, undefined, academicCtx);
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

    const session = await startLab(labId, subtype, academicCtx);
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
    } catch (err) {
      console.error('Failed to stop lab:', err);
    } finally {
      setPendingStop(null);
    }
  };

  const handleStopLabClick = (labId: string) => {
    if (activeSession && activeSession.labId === labId) {
      setPendingStop({ sessionId: activeSession.sessionId, labId });
      setShowStopModal(true);
    }
  };

  const handleResumeLab = (labId: string) => {
    if (activeSession && activeSession.labId === labId) {
      navigate({ to: `/admin/compute/rdp`, search: { labId, sessionId: activeSession.sessionId } });
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
        <div className="w-full px-4 md:px-6 xl:px-10 py-8 space-y-6 max-w-[1600px] mx-auto">

          {semesterFilterQuery ? (
            <div className="mb-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">
                <FlaskConical className="h-4 w-4" />
                <span>Course Practical Labs</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <span>Semester {semesterFilterQuery} Labs</span>
                <Badge variant="outline" className="text-xs font-semibold bg-red-50 text-red-700 border-red-200">
                  {displayLabs.length} Course Lab(s)
                </Badge>
              </h1>
              <p className="text-slate-500 text-sm mt-1.5 max-w-2xl">
                Practical virtual lab environments assigned to your academic courses for Semester {semesterFilterQuery}.
              </p>
            </div>
          ) : (
            <MyLabsHeader labs={labs} />
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

          {(isLoading || isCoursesLoading) && displayLabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
              <p className="text-muted-foreground font-medium">Loading your course labs...</p>
            </div>
          ) : (
            <>
              {/* Only show active labs section if not filtering by semester, and if there are running sessions */}
              {!semesterFilterQuery && activeLabs.length > 0 && (
                <ActiveLabs labs={activeLabs} onResume={handleResumeLab} />
              )}

              <div className="mt-6">
                {displayLabs.length === 0 ? (
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
                        activeSession={activeSession?.labId === lab.id ? activeSession : undefined}
                        elapsedTime={activeSession?.labId === lab.id ? elapsedTime || undefined : undefined}
                        isStarting={startingLabId === lab.id}
                        isStopping={stoppingLabId === lab.id}
                        userCredits={user?.credits}
                      />
                    ))}
                  </div>
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

      {/* Payment Gateway */}
      <PaymentGateway
        open={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setShowCreditModal(null);
        }}
        lab={showCreditModal}
        initialAmount={showCreditModal?.credits || 50}
        onPaymentSuccess={(lab, amount) => {
          updateUser({ credits: (user?.credits || 0) + amount });
        }}
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
    </>
  );
}
