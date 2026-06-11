import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentCourse } from '@/pages/student/dashboard/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';

interface SubjectProgressProps {
  courses: CurrentCourse[];
  semester: number;
}

export function SubjectProgress({ courses, semester }: SubjectProgressProps) {
  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-500" /> Subject Progress
            </CardTitle>
            <CardDescription className="font-medium mt-1">
              Current performance for Semester {semester}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {courses.length} Subjects
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 overflow-auto">
        <div className="space-y-6">
          {courses.map((course) => (
            <div key={course.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {course.subjectName}
                </span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {course.progressPercentage}%
                </span>
              </div>
              <Progress value={course.progressPercentage} className="h-2 bg-slate-100 dark:bg-slate-800" indicatorClassName="bg-indigo-500" />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">Modules: {course.completedModules} / {course.totalModules}</span>
                <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${
                  course.progressPercentage === 100 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : course.progressPercentage > 0 
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {course.progressPercentage === 100 ? 'Completed' : course.progressPercentage > 0 ? 'In Progress' : 'Not Started'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
