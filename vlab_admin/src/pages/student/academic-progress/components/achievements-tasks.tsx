import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Trophy, Star, Target, CheckCircle, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AchievementsTasksProps {
  data: DashboardData;
}

export function AchievementsTasks({ data }: AchievementsTasksProps) {
  // Extracting upcoming tasks from pending milestones or labs as a proxy, 
  // since a dedicated tasks API doesn't exist in the current mock data.
  const upcomingTasks = [
    { title: 'Complete Cloud Computing Module 4', type: 'Subject', due: 'In 2 days' },
    { title: 'Submit Big Data Lab Report', type: 'Lab', due: 'In 5 days' },
    { title: 'Mid-Semester Assessment', type: 'Exam', due: 'Next Week' }
  ];

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" /> Achievements & Tasks
        </CardTitle>
        <CardDescription className="font-medium mt-1">
          Your stats and upcoming academic responsibilities
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col">
        
        {/* Achievements Grid */}
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Academic Achievements</h4>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-100 dark:border-amber-900 p-4 rounded-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-950 shadow-sm flex items-center justify-center shrink-0">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{data.currentGPA.toFixed(1)}</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-1">Current GPA</p>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900 p-4 rounded-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-950 shadow-sm flex items-center justify-center shrink-0">
              <Award className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{data.certificatesEarned}</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-1">Certificates</p>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Upcoming Tasks</h4>
        <div className="space-y-3 flex-1">
          {upcomingTasks.map((task, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{task.title}</p>
                  <p className="text-[10px] font-medium text-rose-500 dark:text-rose-400 mt-0.5">Due: {task.due}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider shrink-0 ml-2">
                {task.type}
              </Badge>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
