import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { dashboardData } from '@/pages/student/dashboard/data';
import { useAuthStore } from '@/stores/auth-store';
import { fetchAuthMe } from '@/Utils/GetApiHandler';
import { GraduationCap, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { AcademicOverview } from './components/academic-overview';
import { ProgramTimeline } from './components/program-timeline';
import { SubjectProgress } from './components/subject-progress';
import { LabCompletionTracker } from './components/lab-completion';
import { PerformanceChart } from './components/performance-chart';
import { WeeklyLearningChart } from './components/weekly-learning-chart';
import { DegreeMilestones } from './components/degree-milestones';
import { AchievementsTasks } from './components/achievements-tasks';
import { SemesterAccordion } from './components/semester-accordion';

export default function AcademicProgress() {
  const { auth } = useAuthStore();
  const u = (auth.user || {}) as any;
  const [selectedProgramIndex, setSelectedProgramIndex] = useState(0);

  useEffect(() => {
    fetchAuthMe()
      .then((data: any) => {
        if (data?.user) {
          useAuthStore.getState().auth.setUser({
            ...data.user,
            userId: data.user.id || data.user.userId,
            fullName: data.user.fullName || data.user.name,
            exp: Date.now() + 24 * 60 * 60 * 1000,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Build programmes list dynamically from LMS GetStudentProfile data
  const rawProgrammes = (u.programmesList && Array.isArray(u.programmesList) && u.programmesList.length > 0)
    ? u.programmesList
    : [
        {
          programmeName: u.programName || dashboardData.student.program.name,
          currentSemester: u.currentSemester || String(dashboardData.student.program.currentSemester),
          enrollmentNumber: u.enrollmentNumber || dashboardData.student.enrollmentNumber,
          totalSemesters: 4,
        }
      ];

  const helperGetShortName = (name: string) => {
    if (!name) return 'MCA';
    if (name.toLowerCase().includes('computer applications') || name.toLowerCase().includes('mca')) return 'MCA';
    if (name.toLowerCase().includes('business administration') || name.toLowerCase().includes('mba')) return 'MBA';
    if (name.toLowerCase().includes('bachelor of technology') || name.toLowerCase().includes('b.tech')) return 'B.Tech';
    const words = name.split(' ').filter(w => w.length > 2 && w.toLowerCase() !== 'and' && w.toLowerCase() !== 'for');
    if (words.length >= 2) {
      return words.map(w => w[0].toUpperCase()).join('');
    }
    return name.substring(0, 10);
  };

  const programmes = rawProgrammes.map((prog: any, idx: number) => {
    const curSem = Number(prog.currentSemester) || 1;
    const totSem = Number(prog.totalSemesters) || 4;
    const calcProgress = Math.min(100, Math.max(15, Math.round(((curSem - 0.35) / totSem) * 100)));

    return {
      id: String(idx + 1),
      name: prog.programmeName || 'Degree Program',
      shortName: helperGetShortName(prog.programmeName || ''),
      totalSemesters: totSem,
      currentSemester: curSem,
      overallProgress: calcProgress,
      startDate: prog.admissionDate || '2026-06-27',
      expectedEndDate: '2028-06-30',
      enrollmentNumber: prog.enrollmentNumber || u.enrollmentNumber || 'N/A',
      totalEnrolledPrograms: rawProgrammes.length
    };
  });

  const activeProgram = programmes[selectedProgramIndex] || programmes[0];

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Dashboard</span>
            <span className="text-border">/</span>
            <span className="text-slate-900 dark:text-white font-semibold">Academic Progress</span>
          </div>
        </div>
      </Header>
      
      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                Academic Progress
              </h1>
              <p className="text-slate-500 mt-1.5 max-w-2xl text-sm">
                Track your academic journey, semester completion, subject progress, lab completion, and degree milestones.
              </p>
            </div>
          </div>

          {/* Dynamic Program Selector Bar (If student has 2 or more LMS Enrolled Programs) */}
          {programmes.length > 1 && (
            <div className="bg-white dark:bg-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Select Academic Program</span>
                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 text-[10px] font-bold">
                      {programmes.length} Programs Enrolled
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Switch between your enrolled degree programs to view specific semester metrics</p>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {programmes.map((prog: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedProgramIndex(idx)}
                    className={`px-4 py-2 rounded-lg text-xs font-sans transition-all flex items-center gap-2 shrink-0 border ${
                      selectedProgramIndex === idx
                        ? 'bg-red-600 text-white border-red-600 shadow-sm font-semibold'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 font-medium'
                    }`}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span className="font-semibold">{prog.shortName}</span>
                    <span className="opacity-90 font-normal">Sem {prog.currentSemester}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Top Row: Academic Overview */}
          <AcademicOverview data={dashboardData} activeProgram={activeProgram} />

          {/* Second Row: Program Timeline */}
          <ProgramTimeline program={activeProgram} />

          {/* Third Row: Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <PerformanceChart data={dashboardData.semesterPerformance} />
            <WeeklyLearningChart data={dashboardData.weeklyActivity} />
          </div>

          {/* Fourth Row: Trackers */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <SubjectProgress courses={dashboardData.currentCourses} semester={activeProgram.currentSemester} />
            <LabCompletionTracker data={dashboardData} />
          </div>

          {/* Fifth Row: Milestones & Tasks */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <DegreeMilestones milestones={dashboardData.milestones} />
            <AchievementsTasks data={dashboardData} />
          </div>

          {/* Bottom Row: Semester Accordion */}
          <div className="w-full">
            <SemesterAccordion data={dashboardData} />
          </div>

        </div>
      </Main>
    </>
  );
}

