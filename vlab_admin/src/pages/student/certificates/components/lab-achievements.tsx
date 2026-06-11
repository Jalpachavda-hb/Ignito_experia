import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Trophy, Star, Shield, Zap, Medal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LabAchievementsProps {
  data: DashboardData;
}

export function LabAchievements({ data }: LabAchievementsProps) {
  const { recentLabs, completedLabs } = data;
  
  // Create badges based on lab progress
  const badges = [
    { title: "Python Expert", desc: "Top 5% in Python Programming Lab", icon: Star, color: "text-amber-500", bg: "bg-amber-100" },
    { title: "Cloud Practitioner", desc: "Completed all AWS Labs", icon: Shield, color: "text-blue-500", bg: "bg-blue-100" },
    { title: "Fast Learner", desc: "Completed 5 labs in 1 week", icon: Zap, color: "text-rose-500", bg: "bg-rose-100" },
    { title: "Top Performer", desc: "Maintained 90%+ average", icon: Medal, color: "text-purple-500", bg: "bg-purple-100" }
  ];

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Lab Achievements
            </CardTitle>
            <CardDescription className="font-medium mt-1">
              Skill badges and practical excellence awards
            </CardDescription>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{completedLabs}</span>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Labs Done</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {badges.map((badge, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-colors shadow-sm">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${badge.bg} dark:opacity-80`}>
                <badge.icon className={`h-6 w-6 ${badge.color}`} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{badge.title}</h4>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Recent High Scores</h4>
          <div className="space-y-3">
            {recentLabs.filter(l => l.status === 'Completed' && l.performanceScore && l.performanceScore >= 90).slice(0, 3).map((lab) => (
              <div key={lab.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-4">{lab.labName}</span>
                <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {lab.performanceScore}% Score
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
