import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SummaryStats } from '../types';
import { Trophy, FlaskConical, Award, Coins, Target, Sparkles } from 'lucide-react';

interface SummaryCardsProps {
  stats: SummaryStats;
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  const cards = [
    {
      title: 'Total Badges',
      value: `${stats.totalBadges} Badges`,
      description: 'Milestones unlocked',
      icon: Trophy,
      color: 'text-rose-500 dark:text-rose-455',
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    },
    {
      title: 'Labs Completed',
      value: `${stats.labsCompleted} Labs`,
      description: 'Hands-on practical logs',
      icon: FlaskConical,
      color: 'text-amber-500 dark:text-amber-455',
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    },
    {
      title: 'Skill Score',
      value: `${stats.skillScore} Points`,
      description: 'Expertise rating points',
      icon: Award,
      color: 'text-emerald-500 dark:text-emerald-455',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    },
    {
      title: 'Credits Earned',
      value: `${stats.creditsEarned} Credits`,
      description: 'Earned through labs',
      icon: Coins,
      color: 'text-blue-500 dark:text-blue-455',
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    },
    {
      title: 'Current Rank',
      value: stats.currentRank.split(' in ')[0],
      description: stats.currentRank.includes(' in ') ? stats.currentRank.split(' in ')[1] : 'MCA Program',
      icon: Target,
      color: 'text-purple-500 dark:text-purple-455',
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    },
    {
      title: 'Achievement Score',
      value: `${stats.achievementPoints} PTS`,
      description: 'Progression points',
      icon: Sparkles,
      color: 'text-pink-500 dark:text-pink-455',
      bg: 'bg-pink-500/10 dark:bg-pink-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => {
        const IconComponent = card.icon;
        return (
          <Card 
            key={i} 
            className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md rounded-[20px] bg-white dark:bg-slate-950"
          >
            {/* Top-right corner color blob */}
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full -mr-3 -mt-3 ${card.bg}`}></div>
            
            <CardContent className="p-5 flex items-center justify-between relative z-10 h-full">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 truncate">
                  {card.title}
                </p>
                <div className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  {card.value}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-full">
                  {card.description}
                </p>
              </div>
              
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 shrink-0 ${card.color}`}>
                <IconComponent className="h-5.5 w-5.5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
