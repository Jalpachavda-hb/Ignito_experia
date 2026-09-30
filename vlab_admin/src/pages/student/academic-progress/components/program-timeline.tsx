import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProgramInfo } from '@/pages/student/dashboard/types';
import { CircleDashed, ArrowRightCircle, Hash, CalendarRange } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProgramTimelineProps {
  program: ProgramInfo & {
    enrollmentNumber?: string;
  };
}

type SemesterItem = {
  number: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
};

function formatDisplayDate(value: unknown) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
  const date = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : dmy
      ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
      : null;
  if (!date || Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function semesterRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} – ${endDate}`;
  return startDate || endDate;
}

export function ProgramTimeline({ program }: ProgramTimelineProps) {
  const currentSem = program.currentSemester != null ? String(program.currentSemester) : null;
  const progress = program.overallProgress != null ? Number(program.overallProgress) : null;
  const reported = progress != null && !Number.isNaN(progress);
  const barWidth = reported ? Math.min(100, Math.max(progress, 0)) : 4;
  const admittedOn = formatDisplayDate(program.startDate);
  const listedSemesters = Array.isArray((program as unknown as { semesters?: unknown[] }).semesters)
    ? (program as unknown as { semesters: unknown[] }).semesters
    : [];
  const semesters = listedSemesters
    .map((item) => {
      if (item != null && typeof item === 'object') {
        const row = item as {
          semesterNumber?: unknown;
          semesterId?: unknown;
          status?: unknown;
          semesterStartDate?: unknown;
          semesterEndDate?: unknown;
          startDate?: unknown;
          endDate?: unknown;
        };
        const number = row.semesterNumber ?? row.semesterId;
        return number == null || number === '' ? null : {
          number: String(number),
          status: row.status ? String(row.status) : null,
          startDate: formatDisplayDate(row.semesterStartDate ?? row.startDate),
          endDate: formatDisplayDate(row.semesterEndDate ?? row.endDate),
        };
      }
      return item == null || item === '' ? null : { number: String(item), status: null, startDate: null, endDate: null };
    })
    .filter((item): item is SemesterItem => Boolean(item));

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
          {admittedOn ? (
            <p className="text-xs text-slate-500 mt-1">Admitted {admittedOn}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-800 shrink-0">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Current Semester</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{currentSem ?? "—"}</p>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Semesters</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{semesters.length || "—"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        
        <div className="mb-8">
          <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white mb-2">
            <span>Overall Degree Completion</span>
            <span className="text-red-600 dark:text-red-500">{reported ? `${progress}%` : 'Pending'}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-500 transition-all"
              style={{ width: reported ? `${barWidth}%` : "2.5rem" }}
            />
          </div>
          {reported ? null : (
            <p className="mt-2 text-xs text-slate-500">
              The university has not sent a completion percentage yet. Your enrolled semester is shown below.
            </p>
          )}
        </div>

        <div className="relative">
          {semesters.length > 1 ? (
            <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800"></div>
          ) : null}
          <div className={`relative z-10 w-full pb-1 ${semesters.length > 1 ? 'flex justify-between overflow-x-auto hide-scrollbar' : 'space-y-3'}`}>
            {semesters.length === 0 ? (
              <p className="text-sm text-slate-500">The university LMS did not return a semester list for this programme.</p>
            ) : semesters.map((sem) => {
              const isCurrent = currentSem != null && sem.number === currentSem;
              const label = sem.status || (isCurrent ? 'Current' : 'Enrolled');
              const range = semesterRange(sem.startDate, sem.endDate);

              if (semesters.length === 1) {
                return (
                  <div key={sem.number} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isCurrent ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                        'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                      }`}>
                        {isCurrent ? <ArrowRightCircle className="h-5 w-5" /> : <CircleDashed className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Semester {sem.number}</p>
                        {range ? (
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                            <span>{range}</span>
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-500">Semester dates were not returned by the university.</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] uppercase font-bold tracking-wider ${
                      isCurrent ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30' :
                      'bg-white text-slate-500 border-slate-200 dark:bg-slate-900'
                    }`}>
                      {label}
                    </Badge>
                  </div>
                );
              }

              return (
                <div key={sem.number} className="flex flex-col items-center min-w-[140px]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-950 shadow-sm ${
                    isCurrent ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                    'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}>
                    {isCurrent ? <ArrowRightCircle className="h-5 w-5" /> : <CircleDashed className="h-5 w-5" />}
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-3">Semester {sem.number}</p>
                  <Badge variant="outline" className={`mt-1.5 text-[10px] uppercase font-bold tracking-wider ${
                    isCurrent ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30' :
                    'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900'
                  }`}>
                    {label}
                  </Badge>
                  {range ? (
                    <p className="mt-1.5 text-[11px] text-slate-500 text-center">{range}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

