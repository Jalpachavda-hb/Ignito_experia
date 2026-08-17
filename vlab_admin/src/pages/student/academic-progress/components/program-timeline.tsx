import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProgramInfo } from '@/pages/student/dashboard/types';
import { CheckCircle2, CircleDashed, ArrowRightCircle, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ProgramTimelineProps {
  program: ProgramInfo & {
    enrollmentNumber?: string;
  };
}

export function ProgramTimeline({ program }: ProgramTimelineProps) {
  const currentSem = Number(program.currentSemester) || 1;
  const totalSem = Number(program.totalSemesters) || 4;
  const progress = program.overallProgress ?? 65;
  const completedCount = Math.max(0, currentSem - 1);
  const remainingCount = Math.max(0, totalSem - currentSem);

  const semesters = Array.from({ length: totalSem }, (_, i) => i + 1);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Program Progress</CardTitle>
            {program.enrollmentNumber && (
              <Badge variant="outline" className="font-sans font-medium text-xs text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex items-center gap-1">
                <Hash className="h-3 w-3 text-slate-400" /> {program.enrollmentNumber}
              </Badge>
            )}
          </div>
          <CardDescription className="font-medium mt-1 text-slate-700 dark:text-slate-300">
            {program.name}
          </CardDescription>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-800 shrink-0">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Completed</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{completedCount}</p>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Remaining</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{remainingCount}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        
        <div className="mb-8">
          <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white mb-2">
            <span>Overall Degree Completion</span>
            <span className="text-red-600 dark:text-red-500">{progress}%</span>
          </div>
          <Progress
            value={progress}
            className="h-3 bg-slate-100 dark:bg-slate-800"
            indicatorColor="bg-gradient-to-r from-red-600 to-rose-500"
          />
        </div>

        <div className="relative">
          <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -z-10"></div>
          <div className="flex justify-between relative z-10 w-full overflow-x-auto pb-4 hide-scrollbar">
            {semesters.map((sem) => {
              const isCompleted = sem < currentSem;
              const isCurrent = sem === currentSem;
              const isPending = sem > currentSem;

              return (
                <div key={sem} className="flex flex-col items-center min-w-[100px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-950 shadow-sm ${
                    isCompleted ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' :
                    isCurrent ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                    'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}>
                    {isCompleted && <CheckCircle2 className="h-5 w-5" />}
                    {isCurrent && <ArrowRightCircle className="h-5 w-5" />}
                    {isPending && <CircleDashed className="h-5 w-5" />}
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-3">Semester {sem}</p>
                  <Badge variant="outline" className={`mt-1.5 text-[10px] uppercase font-bold tracking-wider ${
                    isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30' :
                    isCurrent ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30' :
                    'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900'
                  }`}>
                    {isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Pending'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

