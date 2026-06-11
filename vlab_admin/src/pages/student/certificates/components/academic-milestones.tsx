import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Target, CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AcademicMilestonesProps {
  data: DashboardData;
}

export function AcademicMilestones({ data }: AcademicMilestonesProps) {
  const { milestones } = data;

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-rose-500" /> Academic Milestones
        </CardTitle>
        <CardDescription className="font-medium mt-1">
          Key achievements and program progression
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex-1">
        <div className="space-y-4">
          {milestones.map((milestone, idx) => (
            <div key={milestone.id} className="relative pl-8 pb-4 last:pb-0">
              {/* Vertical line connecting milestones */}
              {idx !== milestones.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-[-16px] w-0.5 bg-slate-100 dark:bg-slate-800"></div>
              )}
              
              <div className="absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm z-10 bg-white dark:bg-slate-950">
                {milestone.status === 'Completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : milestone.status === 'In Progress' ? (
                  <Clock className="h-4 w-4 text-blue-500" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-slate-400" />
                )}
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 ml-2 hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{milestone.title}</h4>
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${
                    milestone.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' :
                    milestone.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900' :
                    'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}>
                    {milestone.status}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-slate-500">{milestone.description}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-2">Year {milestone.year}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
