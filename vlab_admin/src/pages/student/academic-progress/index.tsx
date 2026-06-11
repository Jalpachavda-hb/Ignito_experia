import React from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { dashboardData } from '@/pages/student/dashboard/data';

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
          
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Academic Progress</h1>
            <p className="text-slate-500 mt-1.5 max-w-2xl">
              Track your academic journey, semester completion, subject progress, lab completion, and degree milestones.
            </p>
          </div>
          
          {/* Top Row: Academic Overview */}
          <AcademicOverview data={dashboardData} />

          {/* Second Row: Program Timeline */}
          <ProgramTimeline program={dashboardData.student.program} />

          {/* Third Row: Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <PerformanceChart data={dashboardData.semesterPerformance} />
            <WeeklyLearningChart data={dashboardData.weeklyActivity} />
          </div>

          {/* Fourth Row: Trackers */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <SubjectProgress courses={dashboardData.currentCourses} semester={dashboardData.student.program.currentSemester} />
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
