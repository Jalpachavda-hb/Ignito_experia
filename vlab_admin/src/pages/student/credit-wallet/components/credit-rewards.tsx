import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Medal, Star, Trophy, Award } from 'lucide-react';

export function CreditRewards() {
  const rewards = [
    {
      id: 1,
      title: 'Completion Bonus',
      description: 'Completed 10 labs with >90% score',
      credits: 100,
      icon: Medal,
      color: 'text-amber-500',
      bg: 'bg-amber-100 dark:bg-amber-900/30'
    },
    {
      id: 2,
      title: 'Achievement Reward',
      description: 'Mastered Python Programming Essentials',
      credits: 50,
      icon: Star,
      color: 'text-blue-500',
      bg: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      id: 3,
      title: 'Semester Performance',
      description: 'Top 10% in Semester 2',
      credits: 200,
      icon: Trophy,
      color: 'text-yellow-500',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    {
      id: 4,
      title: 'Faculty Award',
      description: 'Excellence in Cloud Deployment',
      credits: 75,
      icon: Award,
      color: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30'
    }
  ];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Medal className="h-5 w-5 text-amber-500" /> Credit Rewards
        </CardTitle>
        <CardDescription>Extra credits earned through your academic performance.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rewards.map((reward) => (
            <div key={reward.id} className="flex p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className={`shrink-0 w-12 h-12 rounded-full ${reward.bg} flex items-center justify-center mr-4`}>
                <reward.icon className={`h-6 w-6 ${reward.color}`} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{reward.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{reward.description}</p>
                <div className="mt-2 font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
                  +{reward.credits} CRD
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
