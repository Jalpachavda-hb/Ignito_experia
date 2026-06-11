import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { GraduationCap, ArrowRightCircle, CheckCircle2, CircleDashed } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface DegreeProgressProps {
  data: DashboardData;
}

export function DegreeProgress({ data }: DegreeProgressProps) {
  const { program } = data.student;
  const semesters = Array.from({ length: program.totalSemesters }, (_, i) => i + 1);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-500" /> Degree Progress
            </CardTitle>
            <CardDescription className="font-medium mt-1">
              Program completion journey for {program.name}
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{program.overallProgress}%</span>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Completion</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        
        <Progress value={program.overallProgress} className="h-3 mb-8 bg-slate-100 dark:bg-slate-800" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {semesters.map((sem) => {
            const isCompleted = sem < program.currentSemester;
            const isCurrent = sem === program.currentSemester;
            const isPending = sem > program.currentSemester;

            return (
              <div key={sem} className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-colors ${
                isCompleted ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30' :
                isCurrent ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50 shadow-sm' :
                'bg-slate-50 border-slate-100 dark:bg-slate-900/50 dark:border-slate-800'
              }`}>
                <div className={`mb-3 ${
                  isCompleted ? 'text-emerald-500' :
                  isCurrent ? 'text-blue-500' :
                  'text-slate-400'
                }`}>
                  {isCompleted ? <CheckCircle2 className="h-8 w-8" /> : 
                   isCurrent ? <ArrowRightCircle className="h-8 w-8" /> : 
                   <CircleDashed className="h-8 w-8" />}
                </div>
                <h4 className={`text-sm font-bold mb-1 ${isPending ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>Semester {sem}</h4>
                <Badge variant="outline" className={`text-[9px] uppercase font-bold tracking-wider ${
                  isCompleted ? 'border-emerald-200 text-emerald-600' :
                  isCurrent ? 'bg-blue-500 text-white border-blue-500' :
                  'border-slate-200 text-slate-400'
                }`}>
                  {isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Pending'}
                </Badge>
              </div>
            );
          })}
        </div>

      </CardContent>
    </Card>
  );
}
