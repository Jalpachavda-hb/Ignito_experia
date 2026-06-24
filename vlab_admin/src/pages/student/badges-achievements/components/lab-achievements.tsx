import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LabAchievement } from '../types';
import { 
  Trophy, 
  Sparkles, 
  ListChecks, 
  Award, 
  Zap, 
  CheckCircle2, 
  Moon, 
  Lock, 
  Check 
} from 'lucide-react';

interface LabAchievementsProps {
  achievements: LabAchievement[];
}

// Helper to resolve icon by string name
const getIcon = (name: string) => {
  switch (name) {
    case 'Sparkles':
      return Sparkles;
    case 'ListChecks':
      return ListChecks;
    case 'Trophy':
      return Trophy;
    case 'Award':
      return Award;
    case 'Zap':
      return Zap;
    case 'CheckCircle2':
      return CheckCircle2;
    case 'Moon':
      return Moon;
    default:
      return Award;
  }
};

export function LabAchievementsList({ achievements }: LabAchievementsProps) {
  return (
    <Card className="border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" /> Lab Accomplishments
        </CardTitle>
        <CardDescription className="font-semibold text-slate-500 mt-1">
          Badges earned through practical lab milestones and performance
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {achievements.map((achievement) => {
            const IconComponent = getIcon(achievement.iconName);
            
            return (
              <div 
                key={achievement.id} 
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group select-none ${
                  achievement.isUnlocked 
                    ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/40 hover:bg-rose-50/40 dark:hover:bg-rose-950/20' 
                    : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-150 dark:border-slate-850'
                }`}
              >
                {/* Icon Backdrop */}
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105 ${
                  achievement.isUnlocked 
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-455 border-rose-200 dark:border-rose-900/50' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                }`}>
                  {achievement.isUnlocked ? (
                    <IconComponent className="h-6 w-6" />
                  ) : (
                    <Lock className="h-5 w-5 text-slate-400" />
                  )}
                </div>

                {/* Achievement Details */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-sm font-bold truncate ${
                      achievement.isUnlocked ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {achievement.title}
                    </h4>
                    
                    {achievement.isUnlocked ? (
                      <Badge className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 text-[10px] font-bold py-0 px-1.5 shrink-0 flex items-center gap-0.5">
                        <Check className="h-3 w-3" /> Unlocked
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                        {achievement.progress}/{achievement.maxProgress}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs font-semibold text-slate-450 dark:text-slate-500 line-clamp-2 leading-relaxed">
                    {achievement.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
