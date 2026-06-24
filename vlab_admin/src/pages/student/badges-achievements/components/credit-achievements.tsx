import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CreditAchievement } from '../types';
import { Coins, Check, Lock } from 'lucide-react';

interface CreditAchievementsProps {
  achievements: CreditAchievement[];
}

export function CreditAchievementsList({ achievements }: CreditAchievementsProps) {
  return (
    <Card className="border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Coins className="h-5 w-5 text-rose-600 dark:text-rose-450" /> Credit Accomplishments
        </CardTitle>
        <CardDescription className="font-semibold text-slate-500 mt-1">
          Milestones unlocked based on aggregate credit accumulation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex-1 space-y-5">
        {achievements.map((achievement) => {
          const percentage = Math.min(Math.round((achievement.progress / achievement.maxProgress) * 100), 100);
          
          return (
            <div 
              key={achievement.id} 
              className={`p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                achievement.isUnlocked 
                  ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/40 hover:bg-rose-50/40 dark:hover:bg-rose-950/20' 
                  : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-150 dark:border-slate-850'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon Circle */}
                <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105 ${
                  achievement.isUnlocked 
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-455 border-rose-200 dark:border-rose-900/50' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-450 border-slate-200 dark:border-slate-700'
                }`}>
                  {achievement.isUnlocked ? (
                    <Coins className="h-5 w-5" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-sm font-bold truncate ${
                      achievement.isUnlocked ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {achievement.title}
                    </h4>
                    
                    {achievement.isUnlocked ? (
                      <Badge className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 text-[10px] font-bold py-0 px-1.5 shrink-0 flex items-center gap-0.5">
                        <Check className="h-3 w-3" /> Earned
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 shrink-0">
                        {achievement.progress} / {achievement.maxProgress} CR
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs font-semibold text-slate-450 dark:text-slate-500 leading-relaxed">
                    {achievement.description}
                  </p>

                  {/* Progress Indicator for locked achievements */}
                  {!achievement.isUnlocked && (
                    <div className="pt-2.5 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-400 dark:text-slate-500">Progress to Unlock</span>
                        <span className="text-rose-500">{percentage}%</span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className="h-1.5 bg-slate-200 dark:bg-slate-800"
                        indicatorColor="bg-rose-500 dark:bg-rose-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
