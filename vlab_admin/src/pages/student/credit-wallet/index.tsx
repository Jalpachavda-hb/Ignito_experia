import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search, SlidersHorizontal, Loader2, Beaker, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLabStore } from '@/stores/labStore';
import { LabCreditCard, LabCreditInfo } from './components/lab-credit-card';

export default function CreditWallet() {
  const { labs, isLoading, loadLabs } = useLabStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Mock lab credit state for UI demonstration
  const [labCredits, setLabCredits] = useState<Record<string, LabCreditInfo>>({});

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  // Initialize mock credits when labs load
  useEffect(() => {
    if (labs.length > 0 && Object.keys(labCredits).length === 0) {
      const initialCredits: Record<string, LabCreditInfo> = {};
      labs.forEach((lab, index) => {
        // Deterministic mock data based on index
        const allocated = 100 + (index % 3) * 50;
        const used = (index % 4 === 0) ? allocated : (index % 5) * 20;
        initialCredits[lab.id] = {
          allocated,
          used,
          remaining: allocated - used
        };
      });
      setLabCredits(initialCredits);
    }
  }, [labs, labCredits]);

  const handleTopUp = (labId: string, amount: number) => {
    setLabCredits(prev => {
      const current = prev[labId];
      if (!current) return prev;
      return {
        ...prev,
        [labId]: {
          ...current,
          allocated: current.allocated + amount,
          remaining: current.remaining + amount
        }
      };
    });
  };

  const handleApplyCoupon = (labId: string, code: string) => {
    // Arbitrary coupon logic for demo: adds 50 credits
    handleTopUp(labId, 50);
  };

  // Extract unique semesters
  const semesters = useMemo(() => {
    const sems = new Set<string>();
    labs.forEach(lab => {
      if (lab.semester) sems.add(lab.semester);
    });
    return ['All', ...Array.from(sems).sort()];
  }, [labs]);

  // Filter labs
  const filteredLabs = useMemo(() => {
    return labs.filter(lab => {
      // Search
      const matchesSearch = (lab.name || lab.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Semester Filter
      if (semesterFilter !== 'All' && lab.semester !== semesterFilter) return false;

      // Status Filter
      if (statusFilter !== 'All') {
        const credit = labCredits[lab.id];
        if (!credit) return true; // If not initialized, include it
        
        let status = 'Sufficient';
        if (credit.remaining === 0) status = 'Exhausted';
        else if (credit.remaining <= 20) status = 'Low';

        if (statusFilter === 'Sufficient' && status !== 'Sufficient') return false;
        if (statusFilter === 'Low' && status !== 'Low') return false;
        if (statusFilter === 'Exhausted' && status !== 'Exhausted') return false;
      }

      return true;
    });
  }, [labs, searchQuery, semesterFilter, statusFilter, labCredits]);

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Student Portal</span>
            <span className="text-border">/</span>
            <span className="text-slate-900 dark:text-white font-semibold">Lab Credit Allocation</span>
          </div>
        </div>
      </Header>

      <Main className="bg-[#f8fafc] dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
        <div className="w-full p-4 sm:p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Lab Credit Allocation
              </h1>
              <p className="text-slate-500 mt-2 text-sm md:text-base leading-relaxed">
                Manage your virtual lab credits individually. Track your consumed credits, remaining balances, and top-up exactly what you need per lab to continue practicing.
              </p>
            </div>
            
            <div className="shrink-0 bg-white border border-slate-200 shadow-sm rounded-2xl p-4 flex items-center gap-4 min-w-[200px]">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <Beaker className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Enrolled Labs</p>
                <p className="text-xl font-extrabold text-slate-900 leading-none">{labs.length}</p>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-[20px] p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search labs by name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 rounded-[12px] h-11 text-sm font-semibold placeholder:font-medium"
              />
            </div>
            
            <div className="flex w-full md:w-auto items-center gap-3">
              {/* View Toggle */}
              <div className="hidden sm:flex items-center bg-slate-50 p-1 rounded-[12px] border border-slate-200 shrink-0">
                <button 
                  onClick={() => setView('grid')}
                  className={`p-1.5 rounded-[8px] transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded-[8px] transition-colors ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-[12px] border border-slate-200 shrink-0">
                <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filters</span>
              </div>
              
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="w-[140px] h-11 bg-white border-slate-200 rounded-[12px] font-semibold text-sm">
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  {semesters.map(s => (
                    <SelectItem key={s} value={s} className="font-medium text-sm">{s === 'All' ? 'All Semesters' : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-11 bg-white border-slate-200 rounded-[12px] font-semibold text-sm">
                  <SelectValue placeholder="Credit Status" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  <SelectItem value="All" className="font-medium text-sm">All Statuses</SelectItem>
                  <SelectItem value="Sufficient" className="font-medium text-sm">Sufficient</SelectItem>
                  <SelectItem value="Low" className="font-medium text-sm">Low Credits</SelectItem>
                  <SelectItem value="Exhausted" className="font-medium text-sm">Exhausted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          {isLoading && labs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Loading allocations...</p>
            </div>
          ) : filteredLabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[24px] border border-slate-200 border-dashed">
              <Beaker className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-bold text-lg mb-1">No Labs Found</p>
              <p className="text-slate-400 text-sm">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className={view === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6" : "flex flex-col gap-4"}>
              {filteredLabs.map(lab => (
                <LabCreditCard 
                  key={lab.id} 
                  lab={lab} 
                  creditInfo={labCredits[lab.id] || { allocated: 100, used: 0, remaining: 100 }}
                  onTopUp={handleTopUp}
                  onApplyCoupon={handleApplyCoupon}
                  view={view}
                />
              ))}
            </div>
          )}

        </div>
      </Main>
    </>
  );
}
