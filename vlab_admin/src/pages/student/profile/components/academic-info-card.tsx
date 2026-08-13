import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { BookOpen, GraduationCap, Calendar, Hash } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';

interface AcademicInfoCardProps {
  student: StudentProfile;
}

export function AcademicInfoCard({ student }: AcademicInfoCardProps) {
  const { auth } = useAuthStore();
  const u = auth.user || {};

  const programmes = (u.programmesList && Array.isArray(u.programmesList) && u.programmesList.length > 0)
    ? u.programmesList
    : [
        {
          programmeName: u.programName || student.program.name,
          currentSemester: u.currentSemester || String(student.program.currentSemester),
          enrollmentNumber: u.enrollmentNumber || student.enrollmentNumber,
          admissionDate: '27-06-2026 10.46.25 AM'
        }
      ];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" /> Academic & Programme Enrolments
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">University / Institute</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{u.collegeName || student.collegeName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Total Enrolled Programmes</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{programmes.length} Programme(s)</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enrolled Programmes List</p>
          {programmes.map((prog: any, idx: number) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{prog.programmeName}</h4>
                    <p className="text-xs text-slate-500 font-medium">Semester {prog.currentSemester || '1'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 shrink-0">
                  Enrolled
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Hash className="h-3.5 w-3.5 text-slate-400" />
                  <span>Enrollment: <strong className="text-slate-800 dark:text-slate-200">{prog.enrollmentNumber || 'N/A'}</strong></span>
                </div>
                {prog.admissionDate && (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Admission Date: <strong className="text-slate-800 dark:text-slate-200">{prog.admissionDate}</strong></span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
