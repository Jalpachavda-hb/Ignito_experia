import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Beaker, CheckCircle2, Clock, CircleDashed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LabCompletionProps {
  data: DashboardData;
}

export function LabCompletionTracker({ data }: LabCompletionProps) {
  const { academicOverviewStats, recentLabs } = data;
  
  const stats = [
    { label: 'Completed', value: academicOverviewStats.completedLabs, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'In Progress', value: academicOverviewStats.inProgressLabs, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Pending', value: academicOverviewStats.pendingLabs, icon: CircleDashed, color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Beaker className="h-5 w-5 text-emerald-500" /> Lab Completion Tracker
            </CardTitle>
            <CardDescription className="font-medium mt-1">
              Practical assignments and virtual labs
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {academicOverviewStats.totalLabs} Total Labs
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <stat.icon className={`h-6 w-6 mb-2 ${stat.color}`} />
              <div className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Labs List */}
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Assigned Labs Status</h4>
          <div className="space-y-3">
            {recentLabs.map((lab) => (
              <div key={lab.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    lab.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' :
                    lab.status === 'In Progress' ? 'bg-blue-100 text-blue-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {lab.status === 'Completed' ? <CheckCircle2 className="h-4 w-4" /> :
                     lab.status === 'In Progress' ? <Clock className="h-4 w-4" /> :
                     <CircleDashed className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{lab.labName}</p>
                    {lab.status === 'Completed' && <p className="text-[10px] font-medium text-slate-500 mt-0.5">Score: {lab.performanceScore}%</p>}
                    {lab.status === 'In Progress' && <p className="text-[10px] font-medium text-slate-500 mt-0.5">{lab.completionPercentage}% Complete</p>}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider shrink-0 ml-2 ${
                  lab.status === 'Completed' ? 'border-emerald-200 text-emerald-600' :
                  lab.status === 'In Progress' ? 'border-blue-200 text-blue-600' :
                  'border-slate-200 text-slate-500'
                }`}>
                  {lab.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
