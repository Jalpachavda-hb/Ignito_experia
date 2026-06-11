import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { useLabStore } from '@/stores/labStore';
import { CatalogueLabCard } from './components/catalogue-lab-card';
import { Code2, TerminalSquare, Database, LayoutGrid, Server, Beaker, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLabSessionStore } from '@/stores/labSessionStore';
import { useAuthStore } from '@/stores/auth-store';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useNavigate } from '@tanstack/react-router';

export default function LabCatalogue() {
  const { labs, isLoading, error, loadLabs } = useLabStore();
  const { auth } = useAuthStore();
  const { user } = auth;
  const navigate = useNavigate();
  const { activeSession, startingLabId, stoppingLabId, elapsedTime, startLab, stopLab, startError, clearStartError, loadActiveSession } = useLabSessionStore();

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [pendingStop, setPendingStop] = useState<{ sessionId: string, labId: string } | null>(null);

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  // Check Active Session on mount
  useEffect(() => {
    if (!user?.accountNo && !user?.email) return;
    const userId = user.accountNo || user.email;
    loadActiveSession(userId);
  }, [user, loadActiveSession]);

  // Group labs by category
  const categorizedLabs = useMemo(() => {
    const groups: Record<string, typeof labs> = {
      'Programming Labs': [],
      'Linux / Open Source': [],
      'Databases': [],
      '.NET Technologies': [],
      'Other Specialties': []
    };

    labs.forEach(lab => {
      const cat = (lab.category || '').toLowerCase();
      if (cat.includes('programming') || cat.includes('python') || cat.includes('java') || cat.includes('c++')) {
        groups['Programming Labs'].push(lab);
      } else if (cat.includes('linux') || cat.includes('open source') || cat.includes('ubuntu')) {
        groups['Linux / Open Source'].push(lab);
      } else if (cat.includes('database') || cat.includes('sql') || cat.includes('dbms')) {
        groups['Databases'].push(lab);
      } else if (cat.includes('.net') || cat.includes('c#')) {
        groups['.NET Technologies'].push(lab);
      } else {
        groups['Other Specialties'].push(lab);
      }
    });

    // Remove empty categories
    return Object.fromEntries(Object.entries(groups).filter(([_, items]) => items.length > 0));
  }, [labs]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Programming Labs': return <Code2 className="w-4 h-4 text-white" />;
      case 'Linux / Open Source': return <TerminalSquare className="w-4 h-4 text-white" />;
      case 'Databases': return <Database className="w-4 h-4 text-white" />;
      case '.NET Technologies': return <Server className="w-4 h-4 text-white" />;
      default: return <LayoutGrid className="w-4 h-4 text-white" />;
    }
  };

  const handleStartLab = async (id: string) => {
    clearStartError();
    if (!user) return;

    if (activeSession && activeSession.labId !== id) {
      setShowWarningModal(true);
      return;
    }

    const readySession = await startLab(id);
    if (readySession) {
      navigate({ to: `/admin/compute/rdp`, search: { labId: id, sessionId: readySession.sessionId } });
    }
  };

  const handleStopLabClick = (labId: string) => {
    if (activeSession && activeSession.labId === labId) {
      setPendingStop({ sessionId: activeSession.sessionId, labId });
      setShowStopModal(true);
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

  const handleResumeLab = (labId: string) => {
    if (activeSession && activeSession.labId === labId) {
      navigate({ to: `/admin/compute/rdp`, search: { labId, sessionId: activeSession.sessionId } });
    }
  };

  const handleViewDetails = (id: string) => {
    console.log('View details from catalogue', id);
  };

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Dashboard</span>
            <span className="text-border">/</span>
            <span className="text-red-500 font-semibold">Lab Catalogue</span>
          </div>
        </div>
      </Header>

      <Main className="bg-[#f8fafc] dark:bg-background min-h-[calc(100vh-4rem)]">
        <div className="w-full px-4 md:px-8 xl:px-12 py-8 space-y-12 max-w-[1600px] mx-auto">
          
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 shadow-sm">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 bottom-0 w-[60%] bg-gradient-to-l from-red-50/80 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-red-100/50 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                  Our Lab <span className="text-red-500">Catalogue</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed">
                  Explore our hands-on labs designed to enhance practical learning and industry-ready skills in a virtual environment.
                </p>
              </div>

              {/* Total Labs Box */}
              <div className="shrink-0 bg-white/80 backdrop-blur-md border border-red-100 shadow-sm rounded-2xl p-5 flex items-center gap-5 min-w-[240px]">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <Beaker className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Labs Available</p>
                  <p className="text-2xl font-extrabold text-slate-900 leading-none">{labs.length} Labs</p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {startError && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Start Error</AlertTitle>
              <AlertDescription>{startError}</AlertDescription>
            </Alert>
          )}

          {isLoading && labs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
              <p className="text-muted-foreground font-medium">Loading catalogue...</p>
            </div>
          ) : (
            <div className="space-y-12 pb-12">
              {Object.entries(categorizedLabs).map(([category, categoryLabs]) => (
                <div key={category} className="space-y-6">
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shadow-sm">
                        {getCategoryIcon(category)}
                      </div>
                      <h2 className="text-[15px] font-bold text-slate-800 uppercase tracking-wider">
                        {category}
                      </h2>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      {categoryLabs.length} Environment{categoryLabs.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                    {categoryLabs.map((lab, index) => {
                      // Determine if popular (for mock purposes, say top 2 of programming or specific labs)
                      const isPopular = category === 'Programming Labs' && index < 2;
                      
                      return (
                        <CatalogueLabCard 
                          key={lab.id} 
                          lab={lab} 
                          isPopular={isPopular}
                          onStart={handleStartLab}
                          onDetails={handleViewDetails}
                          onStop={handleStopLabClick}
                          onResume={handleResumeLab}
                          activeSession={activeSession?.labId === lab.id ? activeSession : undefined}
                          elapsedTime={activeSession?.labId === lab.id ? elapsedTime || undefined : undefined}
                          isStarting={startingLabId === lab.id}
                          isStopping={stoppingLabId === lab.id}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              {labs.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card rounded-xl border border-dashed border-border/60">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-foreground">No labs found</h3>
                  <p className="text-muted-foreground">Please check back later.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Main>

      <ConfirmDialog
        open={showWarningModal}
        onOpenChange={setShowWarningModal}
        handleConfirm={() => setShowWarningModal(false)}
        title="Active Session Found"
        desc="You already have an active lab session. Please stop the current lab before starting a new one."
        confirmText="OK"
        cancelBtnText="Close"
      />

      <ConfirmDialog
        open={showStopModal}
        onOpenChange={setShowStopModal}
        handleConfirm={handleStopLabConfirm}
        title="Stop Lab Session?"
        desc="Are you sure you want to stop this lab? This action will terminate the running environment."
        confirmText="Stop Lab"
        cancelBtnText="Cancel"
      />
    </>
  );
}
