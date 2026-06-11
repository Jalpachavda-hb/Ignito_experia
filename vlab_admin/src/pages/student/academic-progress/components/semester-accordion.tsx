import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Layers, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SemesterAccordionProps {
  data: DashboardData;
}

export function SemesterAccordion({ data }: SemesterAccordionProps) {
  const { currentCourses, student } = data;
  const [openCurrent, setOpenCurrent] = useState(true);
  const [openPast, setOpenPast] = useState(false);

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-teal-500" /> Semester Details
        </CardTitle>
        <CardDescription className="font-medium mt-1">
          Detailed breakdown of your semester curriculum
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex-1">
        
        <div className="w-full space-y-4">
          
          {/* Current Semester Accordion Item */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-950">
            <button 
              onClick={() => setOpenCurrent(!openCurrent)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {student.program.currentSemester}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Semester {student.program.currentSemester}</h4>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">Current Semester Curriculum</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900 uppercase tracking-wider text-[10px]">
                  In Progress
                </Badge>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${openCurrent ? 'rotate-180' : ''}`} />
              </div>
            </button>
            
            {openCurrent && (
              <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Enrolled Subjects</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentCourses.map((course) => (
                      <div key={course.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{course.subjectName}</p>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-xs text-slate-500">Modules: {course.totalModules}</p>
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{course.progressPercentage}% Done</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Past Semester Accordion Item (Placeholder) */}
          {student.program.currentSemester > 1 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-950">
              <button 
                onClick={() => setOpenPast(!openPast)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {student.program.currentSemester - 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Semester {student.program.currentSemester - 1}</h4>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Previous Semester</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900 uppercase tracking-wider text-[10px]">
                    Completed
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${openPast ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {openPast && (
                <div className="px-4 py-6 border-t border-slate-100 dark:border-slate-800 text-center animate-in fade-in slide-in-from-top-2">
                  <p className="text-sm text-slate-500 font-medium">Historical subject data is archived.</p>
                </div>
              )}
            </div>
          )}

        </div>

      </CardContent>
    </Card>
  );
}
