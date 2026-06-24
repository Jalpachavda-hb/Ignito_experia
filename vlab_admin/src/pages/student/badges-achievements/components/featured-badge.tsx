import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge as UIPropsBadge } from '@/components/ui/badge';
import { Badge } from '../types';
import { Trophy, Calendar, Compass, ShieldAlert, Sparkles } from 'lucide-react';

interface FeaturedBadgeProps {
  badge: Badge;
}

export function FeaturedBadge({ badge }: FeaturedBadgeProps) {
  return (
    <Card className="relative overflow-hidden border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300">
      {/* Glow decorative effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-rose-200/10 dark:bg-rose-950/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-200/5 dark:bg-amber-950/5 rounded-full blur-2xl -ml-8 -mb-8 pointer-events-none" />

      <CardContent className="p-6 md:p-8 relative">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
          
          {/* Badge Emblem Showcase */}
          <div className="relative shrink-0 flex items-center justify-center">
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full bg-rose-500/10 dark:bg-rose-500/20 animate-pulse scale-110" />
            
            {/* Outer styled badge shield */}
            <div className="h-28 w-28 md:h-36 md:w-36 rounded-full bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 p-1.5 shadow-lg flex items-center justify-center select-none transform hover:rotate-12 transition-transform duration-500">
              <div className="h-full w-full rounded-full bg-slate-900 flex flex-col items-center justify-center text-center p-2 border border-slate-800/80">
                <Trophy className="h-10 w-10 md:h-12 md:w-12 text-amber-400 animate-bounce" />
                <span className="text-[10px] md:text-xs font-black text-rose-400 uppercase tracking-widest mt-1">EXPERT</span>
              </div>
            </div>
            
            {/* Floating stars decoration */}
            <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-500 animate-pulse" />
          </div>

          {/* Badge Info Details */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <UIPropsBadge className="bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-950 border-rose-200 dark:border-rose-900 font-bold uppercase text-[10px] tracking-wider py-0.5 px-2">
                Most Recent Badge
              </UIPropsBadge>
              <UIPropsBadge variant="outline" className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider py-0.5 px-2">
                {badge.category}
              </UIPropsBadge>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {badge.name}
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-3xl font-medium">
                {badge.description}
              </p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-rose-500" />
                <span>Earned on: {badge.earnedDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-amber-500" />
                <span>Difficulty: <span className="text-amber-600 dark:text-amber-400 font-bold">{badge.difficulty}</span></span>
              </div>
            </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}
