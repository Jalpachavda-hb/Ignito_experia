import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '../types';
import { 
  Lock, 
  Terminal, 
  Database, 
  Cloud, 
  Code2, 
  BrainCircuit, 
  Bug, 
  Cpu, 
  Award 
} from 'lucide-react';

interface UpcomingBadgesProps {
  badges: Badge[];
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Programming':
      return Code2;
    case 'Database':
      return Database;
    case 'Linux':
      return Terminal;
    case 'Cloud':
      return Cloud;
    case 'Data Science':
      return BrainCircuit;
    case 'Software Testing':
      return Bug;
    case 'Software Engineering':
      return Cpu;
    default:
      return Award;
  }
};

export function UpcomingBadgesList({ badges }: UpcomingBadgesProps) {
  return (
    <Card className="border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lock className="h-4.5 w-4.5 text-slate-500" /> Upcoming Badges
        </CardTitle>
        <CardDescription className="font-semibold text-slate-500 mt-1">
          Locked badges on your roadmap with current task progress
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex-1 space-y-4">
        {badges.map((badge) => {
          const IconComponent = getCategoryIcon(badge.category);
          
          return (
            <div 
              key={badge.id}
              className="p-4 rounded-xl border border-slate-150 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-900/10 transition-all duration-300 group hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                {/* Locked Icon Box */}
                <div className="h-11 w-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-550 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center shrink-0 relative">
                  <IconComponent className="h-5 w-5 opacity-40 group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center border border-white dark:border-slate-900 shadow-sm">
                    <Lock className="h-2.5 w-2.5 text-slate-500 dark:text-slate-400" />
                  </div>
                </div>

                {/* Progress Details */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350 truncate">
                      {badge.name}
                    </h4>
                    <span className="text-[10px] font-black text-rose-500 shrink-0">
                      {badge.progress}%
                    </span>
                  </div>
                  
                  <p className="text-xs font-semibold text-slate-450 dark:text-slate-500 leading-relaxed line-clamp-2">
                    {badge.description}
                  </p>

                  {/* Progress Indicator */}
                  <div className="space-y-1 pt-1">
                    <Progress 
                      value={badge.progress} 
                      className="h-1.5 bg-slate-200 dark:bg-slate-800"
                      indicatorColor="bg-rose-500 dark:bg-rose-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
