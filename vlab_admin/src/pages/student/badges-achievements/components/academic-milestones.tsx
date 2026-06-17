import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AcademicMilestone } from '../types';
import { GraduationCap, CheckCircle2, Clock, Lock, ArrowUpRight } from 'lucide-react';

interface AcademicMilestonesProps {
  milestones: AcademicMilestone[];
}

export function AcademicMilestonesTimeline({ milestones }: AcademicMilestonesProps) {
  return (
    <Card className="border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-rose-650 dark:text-rose-400" /> NEP Academic Milestones
        </CardTitle>
        <CardDescription className="font-semibold text-slate-500 mt-1">
          National Education Policy degree exit checkpoints and progression eligibility
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex-1">
        <div className="space-y-6">
          {milestones.map((milestone, idx) => (
            <div key={milestone.id} className="relative pl-8 pb-4 last:pb-0">
              
              {/* Vertical timeline connector line */}
              {idx !== milestones.length - 1 && (
                <div className={`absolute left-[11px] top-6 bottom-[-24px] w-0.5 ${
                  milestone.status === 'Completed' 
                    ? 'bg-rose-500/80 dark:bg-rose-500/30' 
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}></div>
              )}
              
              {/* Status Circle Node Indicator */}
              <div className="absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm z-10 bg-white dark:bg-slate-950">
                {milestone.status === 'Completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : milestone.status === 'In Progress' ? (
                  <Clock className="h-4 w-4 text-rose-500 animate-spin" style={{ animationDuration: '3s' }} />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />
                )}
              </div>
              
              {/* Content Panel */}
              <div className={`p-4 rounded-xl border ml-2 transition-all duration-300 ${
                milestone.status === 'Completed' 
                  ? 'bg-rose-50/5 dark:bg-rose-950/5 border-rose-100/60 dark:border-rose-900/30' 
                  : milestone.status === 'In Progress'
                  ? 'bg-white dark:bg-card border-rose-200 dark:border-rose-900/70 shadow-sm ring-1 ring-rose-500/20'
                  : 'bg-slate-50/30 dark:bg-slate-900/10 border-slate-150 dark:border-slate-850'
              }`}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                  <div>
                    <span className="text-[10px] uppercase font-black text-rose-500 dark:text-rose-455 tracking-widest">
                      Year {milestone.year}
                    </span>
                    <h4 className={`text-sm font-bold mt-0.5 ${
                      milestone.status !== 'Locked' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'
                    }`}>
                      {milestone.title}
                    </h4>
                  </div>
                  
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${
                    milestone.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' :
                    milestone.status === 'In Progress' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900' :
                    'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
                  }`}>
                    {milestone.status}
                  </Badge>
                </div>
                
                <p className={`text-xs leading-relaxed font-semibold ${
                  milestone.status !== 'Locked' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400/80 dark:text-slate-600/80'
                }`}>
                  {milestone.description}
                </p>
                
                {/* Eligible Exit Reward badge */}
                <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100 dark:border-slate-850 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider">Eligible Exit Status:</span>
                  <span className={`flex items-center gap-0.5 font-bold ${
                    milestone.status !== 'Locked' ? 'text-rose-600 dark:text-rose-450' : 'text-slate-400 dark:text-slate-600'
                  }`}>
                    {milestone.eligibleStatus}
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
              
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
