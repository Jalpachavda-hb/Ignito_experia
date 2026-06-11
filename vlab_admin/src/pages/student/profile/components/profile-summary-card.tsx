import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { CheckCircle2, AlertTriangle, GraduationCap } from 'lucide-react';

interface ProfileSummaryCardProps {
  student: StudentProfile;
}

export function ProfileSummaryCard({ student }: ProfileSummaryCardProps) {
  const isGoodStanding = student.academicStatus === 'Good Standing';

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden relative">
      <div className="absolute inset-0 h-24 z-0" style={{ backgroundColor: '#fcdadb' }}></div>
      <CardContent className="pt-12 relative z-10 px-6 md:px-8 pb-6 sm:pb-8">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
          
          <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-950 bg-slate-100 overflow-hidden shadow-sm shrink-0 mt-4 md:mt-0">
            <img 
              src={student.avatar} 
              alt={student.name}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex-1 text-center md:text-left flex flex-col items-center md:items-start w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
              {student.name}
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1 mb-4">
              {student.enrollmentNumber}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4 md:mb-0">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Active
              </Badge>
              <Badge variant="outline" className={`${
                isGoodStanding 
                  ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900'
                  : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
              }`}>
                {isGoodStanding ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                {student.academicStatus}
              </Badge>
            </div>
          </div>

          <div className="w-full md:w-auto bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex items-start gap-3 shrink-0">
            <GraduationCap className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-left">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {student.program.name}
              </h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Semester {student.program.currentSemester} of {student.program.totalSemesters}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {student.collegeName}
              </p>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
