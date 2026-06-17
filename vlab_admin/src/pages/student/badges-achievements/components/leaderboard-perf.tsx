import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LeaderboardPerf } from '../types';
import { Trophy, Award, Landmark, GraduationCap, Users } from 'lucide-react';

interface LeaderboardPerfProps {
  data: LeaderboardPerf;
}

export function LeaderboardPerformance({ data }: LeaderboardPerfProps) {
  const ranks = [
    {
      label: 'Class Rank',
      value: `#${data.classRank}`,
      icon: Users,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/20 shadow-sm border border-rose-100/40 dark:border-rose-900/20',
    },
    {
      label: 'Department Rank',
      value: `#${data.departmentRank}`,
      icon: Landmark,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/20 shadow-sm border border-amber-100/40 dark:border-amber-900/20',
    },
    {
      label: 'Program Rank',
      value: `#${data.programRank}`,
      icon: GraduationCap,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20 shadow-sm border border-emerald-100/40 dark:border-emerald-900/20',
      subText: data.programName,
    },
    {
      label: 'College Rank',
      value: `#${data.collegeRank}`,
      icon: Trophy,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20 shadow-sm border border-blue-100/40 dark:border-blue-900/20',
    },
  ];

  return (
    <Card className="border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trophy className="h-5 w-5 text-rose-600 dark:text-rose-450" /> Leaderboard Performance
        </CardTitle>
        <CardDescription className="font-semibold text-slate-500 mt-1">
          Real-time standing in program assessments and laboratory points
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex-1 flex flex-col justify-between space-y-6">
        
        {/* Top Rank Percentile Showcase Hero */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-950/50 dark:to-rose-900/40 text-white rounded-xl p-5 shadow-md flex items-center justify-between gap-4 select-none relative overflow-hidden group">
          {/* Decorative background glow */}
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          
          <div className="space-y-1 relative">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-200">
              Platform Percentile
            </span>
            <h3 className="text-2xl font-bold tracking-tight">
              Top {100 - data.percentile}% of Students
            </h3>
            <p className="text-xs text-rose-100 font-semibold max-w-xs leading-relaxed">
              Based on active attendance, credit score weight, and lab checkins.
            </p>
          </div>
          
          <div className="shrink-0 h-16 w-16 bg-white/10 dark:bg-rose-500/20 rounded-full flex items-center justify-center border border-white/20 dark:border-rose-400/30 group-hover:scale-105 transition-transform duration-300">
            <Award className="h-8 w-8 text-rose-100" />
          </div>
        </div>

        {/* Detailed Grid Lists */}
        <div className="grid grid-cols-2 gap-4 flex-1">
          {ranks.map((rank, i) => {
            const IconComponent = rank.icon;
            return (
              <div 
                key={i} 
                className={`p-4 rounded-xl flex items-center gap-3.5 transition-all duration-350 hover:shadow hover:-translate-y-0.5 ${rank.bgColor}`}
              >
                <div className={`p-2 rounded-lg bg-white dark:bg-card shadow-sm border border-slate-200/40 dark:border-slate-800 shrink-0`}>
                  <IconComponent className={`h-5 w-5 ${rank.color}`} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider block">
                    {rank.label}
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white block leading-tight mt-0.5">
                    {rank.value}
                  </span>
                  {rank.subText && (
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block truncate">
                      {rank.subText}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </CardContent>
    </Card>
  );
}
