import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, BookOpen, Clock, Target, CheckCircle2 } from 'lucide-react';
import { DashboardData } from '@/pages/student/dashboard/types';

interface AcademicOverviewProps {
  data: DashboardData;
}

export function AcademicOverview({ data }: AcademicOverviewProps) {
  const { program } = data.student;
  const completedSemesters = program.currentSemester - 1;
  const remainingSemesters = program.totalSemesters - program.currentSemester;
  
  const stats = [
    {
      title: "Program",
      value: "MCA",
      description: "Current Enrollment",
      icon: GraduationCap,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      title: "Current Semester",
      value: `Sem ${program.currentSemester}`,
      description: `${completedSemesters} Completed, ${remainingSemesters} Remaining`,
      icon: Clock,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      title: "Completed Labs",
      value: data.academicOverviewStats.completedLabs.toString(),
      description: `Out of ${data.academicOverviewStats.totalLabs} Total Labs`,
      icon: BookOpen,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20"
    },
    {
      title: "Overall Progress",
      value: `${program.overallProgress}%`,
      description: "Degree Completion",
      icon: Target,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-900/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i} className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 ${stat.bgColor}`}></div>
          <CardContent className="p-5 flex items-center justify-between relative z-10 h-full">
            <div className="flex flex-col justify-between h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {stat.title}
              </p>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {stat.value}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                {stat.description}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 shrink-0 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
