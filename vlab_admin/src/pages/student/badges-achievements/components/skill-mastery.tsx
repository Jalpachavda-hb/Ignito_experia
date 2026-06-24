import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SkillMastery } from '../types';
import { Award, GraduationCap, Percent } from 'lucide-react';

interface SkillMasteryProps {
  skills: SkillMastery[];
}

export function SkillMasteryTracker({ skills }: SkillMasteryProps) {
  // Split skills to showcase progress rings for top 3, and progress bars for the rest
  const topSkills = skills.slice(0, 3);
  const remainingSkills = skills.slice(3);

  return (
    <Card className="border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="h-5 w-5 text-rose-600 dark:text-rose-400" /> Skill Mastery Tracker
        </CardTitle>
        <CardDescription className="font-semibold text-slate-500 mt-1">
          Measured expertise based on automated practical lab evaluations
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 flex-1 flex flex-col justify-between space-y-6">
        
        {/* Top Section: Progress Rings (Top 3 Skills) */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Core Skill Focus</h4>
          <div className="grid grid-cols-3 gap-4">
            {topSkills.map((skill) => {
              const radius = 34;
              const strokeWidth = 6;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (skill.percentage / 100) * circumference;

              return (
                <div key={skill.skillName} className="flex flex-col items-center text-center space-y-2 group">
                  <div className="relative h-22 w-22 flex items-center justify-center">
                    {/* SVG Progress Ring */}
                    <svg className="w-full h-full transform -rotate-90">
                      {/* Track */}
                      <circle
                        cx="44"
                        cy="44"
                        r={radius}
                        className="stroke-slate-100 dark:stroke-slate-850 fill-transparent"
                        strokeWidth={strokeWidth}
                      />
                      {/* Active Indicator */}
                      <circle
                        cx="44"
                        cy="44"
                        r={radius}
                        className="stroke-rose-600 dark:stroke-rose-500 fill-transparent transition-all duration-1000 ease-out"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center mt-0.5">
                      <span className="text-base font-black text-slate-900 dark:text-white">{skill.percentage}%</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-350 tracking-wide truncate max-w-full">
                    {skill.skillName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Progress Bars (Remaining Skills) */}
        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-850">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Skill Directory</h4>
          <div className="space-y-3.5">
            {remainingSkills.map((skill) => (
              <div key={skill.skillName} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{skill.skillName}</span>
                  <span className="font-black text-rose-600 dark:text-rose-450">{skill.percentage}%</span>
                </div>
                <Progress 
                  value={skill.percentage} 
                  className="h-2 bg-slate-100 dark:bg-slate-800"
                  indicatorColor="bg-rose-600 dark:bg-rose-500"
                />
              </div>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
