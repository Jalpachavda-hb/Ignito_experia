import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Star, Award, TrendingUp, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AchievementShowcaseProps {
  data: DashboardData;
}

export function AchievementShowcase({ data }: AchievementShowcaseProps) {
  const achievements = [
    {
      title: "Academic Excellence",
      subtitle: `GPA: ${data.currentGPA.toFixed(1)} / 4.0`,
      desc: "Awarded for maintaining a high grade point average across all semesters.",
      icon: Star,
      theme: "from-amber-400 to-orange-500",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900/50"
    },
    {
      title: "Lab Mastery Award",
      subtitle: `${data.completedLabs} Labs Completed`,
      desc: "Special recognition for completing extensive practical assignments.",
      icon: Award,
      theme: "from-blue-400 to-indigo-500",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-900/50"
    },
    {
      title: "Consistent Performer",
      subtitle: `${data.attendancePercentage}% Attendance`,
      desc: "Recognized for outstanding attendance and consistent participation.",
      icon: TrendingUp,
      theme: "from-emerald-400 to-teal-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-900/50"
    }
  ];

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" /> Achievement Showcase
        </CardTitle>
        <CardDescription className="font-medium mt-1">
          Special academic and practical recognitions
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {achievements.map((achievement, idx) => (
            <div key={idx} className={`p-5 rounded-xl border ${achievement.bg} ${achievement.border} flex flex-col items-center text-center relative overflow-hidden group`}>
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${achievement.theme} opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
              
              <div className={`w-14 h-14 rounded-full bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center mb-4 z-10 relative border border-slate-100 dark:border-slate-800`}>
                <achievement.icon className={`h-7 w-7 text-transparent bg-clip-text bg-gradient-to-br ${achievement.theme}`} style={{ color: 'transparent', fill: 'url(#gradient)' }} />
                <svg width="0" height="0">
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop stopColor="currentColor" offset="0%" />
                    <stop stopColor="currentColor" offset="100%" />
                  </linearGradient>
                </svg>
                {/* Fallback color icon since bg-clip-text on SVG can be tricky */}
                <achievement.icon className="h-7 w-7 absolute inset-0 m-auto text-slate-700 dark:text-slate-300 mix-blend-color" />
              </div>
              
              <h3 className="font-bold text-slate-900 dark:text-white mb-1 z-10 relative">{achievement.title}</h3>
              <Badge variant="outline" className="mb-3 bg-white/50 dark:bg-slate-950/50 backdrop-blur z-10 relative">{achievement.subtitle}</Badge>
              <p className="text-xs text-slate-600 dark:text-slate-400 z-10 relative leading-relaxed">{achievement.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
