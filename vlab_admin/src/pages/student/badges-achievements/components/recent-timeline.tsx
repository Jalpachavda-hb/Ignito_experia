import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RecentAchievement } from '../types';
import { 
  Activity, 
  Trophy, 
  Coins, 
  FlaskConical, 
  GraduationCap, 
  Sparkles, 
  ArrowRight 
} from 'lucide-react';

interface RecentTimelineProps {
  timeline: RecentAchievement[];
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'badge':
      return Trophy;
    case 'credit':
      return Coins;
    case 'lab':
      return FlaskConical;
    case 'milestone':
      return GraduationCap;
    default:
      return Sparkles;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'badge':
      return 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/30';
    case 'credit':
      return 'text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/30';
    case 'lab':
      return 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/30';
    case 'milestone':
      return 'text-purple-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/30';
    default:
      return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/30';
  }
};

export function RecentAchievementTimeline({ timeline }: RecentTimelineProps) {
  return (
    <Card className="border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-rose-650 dark:text-rose-400 animate-pulse" /> Recent Achievements Feed
        </CardTitle>
        <CardDescription className="font-semibold text-slate-500 mt-1">
          Chronological activity logs of your learning victories
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex-1">
        <div className="space-y-5">
          {timeline.map((item, idx) => {
            const IconComponent = getCategoryIcon(item.category);
            const styleClasses = getCategoryColor(item.category);
            
            return (
              <div key={item.id} className="relative pl-7 pb-4 last:pb-0">
                {/* Vertical line connecting feed */}
                {idx !== timeline.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-[-20px] w-0.5 bg-slate-150 dark:bg-slate-800" />
                )}
                
                {/* Connector Dot */}
                <div className="absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm z-10 bg-white dark:bg-slate-950">
                  <div className={`h-2.5 w-2.5 rounded-full ${
                    item.category === 'badge' ? 'bg-amber-500' :
                    item.category === 'credit' ? 'bg-blue-500' :
                    item.category === 'lab' ? 'bg-rose-500' :
                    'bg-emerald-500'
                  }`} />
                </div>

                {/* Timeline Panel */}
                <div className="flex items-center justify-between gap-4 ml-2 p-3 rounded-lg border border-slate-100/60 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/10 hover:border-rose-100 dark:hover:border-rose-900/40 hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-all duration-300">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Category Icon */}
                    <div className={`p-2 rounded-lg border shrink-0 ${styleClasses}`}>
                      <IconComponent className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate leading-relaxed">
                        {item.message}
                      </p>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">
                        {item.timestamp}
                      </span>
                    </div>
                  </div>
                  
                  <ArrowRight className="h-4 w-4 text-slate-350 dark:text-slate-700 shrink-0 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
