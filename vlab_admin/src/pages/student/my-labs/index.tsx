import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { useLabStore } from '@/stores/labStore';
import { MyLabsHeader } from './components/my-labs-header';
import { ActiveLabs } from './components/active-labs';
import { LabFilters } from './components/lab-filters';
import { LabCard } from './components/lab-card';
import { FilterStatus, SortOption, ViewMode } from './types';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth-store';
import { useLabSessionStore } from '@/stores/labSessionStore';
import { SessionTimeoutModal } from './components/session-timeout-modal';
import { PaymentGateway } from './components/payment-gateway';
import { ConfirmDialog } from '@/components/confirm-dialog';

export default function MyLabs() {
  const { labs, isLoading, error, loadLabs } = useLabStore();
  const { auth } = useAuthStore();
  const { user, updateUser } = auth;
  const navigate = useNavigate();

  const searchParams = useSearch({ strict: false }) as { semester?: string };
  const semesterFilterQuery = searchParams.semester;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('All Labs');
  const [sortOption, setSortOption] = useState<SortOption>('Name');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const { activeSession, startingLabId, stoppingLabId, elapsedTime, startError, loadActiveSession, startLab, stopLab, clearStartError } = useLabSessionStore();

  const [pendingStop, setPendingStop] = useState<{ sessionId: string, labId: string } | null>(null);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState<any>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  // 1. Check Active Session on mount
  useEffect(() => {
    if (!user?.accountNo && !user?.email) return;
    const userId = user.accountNo || user.email;
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
    return labs.filter(lab => lab.status === 'In Progress' || lab.status === 'active' || activeSession?.labId === lab.id);
  }, [labs, activeSession]);

  // Filtering and sorting logic
  const filteredLabs = useMemo(() => {
    return labs
      .filter((lab) => {
        // Semester Filter from URL
        if (semesterFilterQuery) {
          // Fallback matching if lab.semester doesn't exist but we want to simulate filtering
          const labSemester = lab.semester || (lab.id && parseInt(lab.id.replace(/\D/g, '')) % 2 === 0 ? '2' : '1'); 
          if (!labSemester.toLowerCase().includes(String(semesterFilterQuery).toLowerCase()) && labSemester !== String(semesterFilterQuery)) {
            return false;
          }
        }

        // Search
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const name = (lab.title || lab.name || '').toLowerCase();
          const desc = (lab.description || '').toLowerCase();
          const cat = (lab.category || '').toLowerCase();
          if (!name.includes(q) && !desc.includes(q) && !cat.includes(q)) {
            return false;
          }
        }
        
        // Status Filter
        if (statusFilter !== 'All Labs') {
          const labStatus = lab.status || 'Not Started';
          if (statusFilter === 'In Progress' && labStatus !== 'In Progress' && labStatus !== 'active') return false;
          if (statusFilter === 'Completed' && labStatus !== 'Completed') return false;
          if (statusFilter === 'Not Started' && labStatus !== 'Not Started' && labStatus !== undefined) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'Name': {
            const nameA = a.title || a.name || '';
            const nameB = b.title || b.name || '';
            return nameA.localeCompare(nameB);
          }
          case 'Credits':
            return (a.credits || 0) - (b.credits || 0);
          case 'Duration':
            return (a.duration || 0) - (b.duration || 0);
          case 'Recently Accessed':
            // If backend provides a lastAccessed date, sort by it. Otherwise fallback to ID or Name
            return (b.id || '').localeCompare(a.id || '');
          default:
            return 0;
        }
      });
  }, [labs, searchQuery, statusFilter, sortOption]);

  const handleStartLab = async (labId: string) => {
    const lab = labs.find(l => l.id === labId);
    if (!lab) return;

    clearStartError();
    if (!user) {
      // Handle login requirement
      return;
    }

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

    const readySession = await startLab(labId);
    if (readySession) {
      navigate({ to: `/admin/compute/rdp`, search: { labId, sessionId: readySession.sessionId } });
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
              {semesterFilterQuery ? `Semester ${semesterFilterQuery} Labs` : 'My Labs'}
            </span>
          </div>
        </div>
      </Header>

      <Main className="bg-[#f8fafc] dark:bg-background min-h-[calc(100vh-4rem)]">
        <div className="w-full px-4 md:px-6 xl:px-10 py-8 space-y-6 max-w-[1600px] mx-auto">
          
          {semesterFilterQuery ? (
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Semester {semesterFilterQuery} Labs
              </h1>
              <p className="text-slate-500 mt-1.5 max-w-2xl">
                Here are all the practical labs and assignments scheduled for this semester.
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

          {isLoading && labs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
              <p className="text-muted-foreground font-medium">Loading your labs...</p>
            </div>
          ) : (
            <>
              {/* Only show active labs section if not filtering by semester, and if there are running sessions */}
              {!semesterFilterQuery && activeLabs.length > 0 && (
                <ActiveLabs labs={activeLabs} onResume={handleResumeLab} />
              )}

              <div className="mt-8">
                <LabFilters 
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  sortOption={sortOption}
                  setSortOption={setSortOption}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                />

                {filteredLabs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-xl border border-dashed border-border/60">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-bold text-foreground">No labs found</h3>
                    <p className="text-muted-foreground">Try adjusting your search or filters.</p>
                  </div>
                ) : (
                  <div className={
                    viewMode === 'grid' 
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6"
                      : "flex flex-col gap-4"
                  }>
                    {filteredLabs.map(lab => (
                      <LabCard 
                        key={lab.id} 
                        lab={lab} 
                        viewMode={viewMode}
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
          // Could optionally start the lab automatically after success
        }}
      />

      {/* Timeout Modal */}
      <SessionTimeoutModal 
        session={activeSession} 
      />
    </>
  );
}
