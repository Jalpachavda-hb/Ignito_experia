import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge as UIPropsBadge } from '@/components/ui/badge';
import { Badge } from '../types';
import { 
  Code2, 
  Database, 
  Terminal, 
  Cloud, 
  BrainCircuit, 
  Bug, 
  Cpu, 
  Award, 
  Calendar, 
  ShieldAlert, 
  Briefcase 
} from 'lucide-react';

interface BadgeGridProps {
  badges: Badge[];
}

// Map categories to icons
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

// Map categories to style colors
const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Programming':
      return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-100 dark:border-blue-900/30' };
    case 'Database':
      return { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-100 dark:border-indigo-900/30' };
    case 'Linux':
      return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900/30' };
    case 'Cloud':
      return { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-100 dark:border-sky-900/30' };
    case 'Data Science':
      return { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-100 dark:border-purple-900/30' };
    case 'Software Testing':
      return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-100 dark:border-amber-900/30' };
    case 'Software Engineering':
      return { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-100 dark:border-rose-900/30' };
    default:
      return { text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-100 dark:border-slate-800' };
  }
};

// Map difficulty labels to style classes
const getDifficultyBadge = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900';
    case 'Intermediate':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900';
    case 'Advanced':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900';
    case 'Expert':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-800';
  }
};

export function BadgeGrid({ badges }: BadgeGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const categories = [
    'All',
    'Programming',
    'Database',
    'Linux',
    'Cloud',
    'Data Science',
    'Software Testing',
    'Software Engineering'
  ];

  const filteredBadges = selectedCategory === 'All' 
    ? badges 
    : badges.filter(b => b.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Category selection tabs header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pr-4 max-w-full">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition-all duration-200 cursor-pointer ${
                selectedCategory === category 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
          Showing {filteredBadges.length} Badges
        </div>
      </div>

      {/* Grid of badges */}
      {filteredBadges.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBadges.map((badge) => {
            const IconComponent = getCategoryIcon(badge.category);
            const themeColors = getCategoryColor(badge.category);
            
            return (
              <Card 
                key={badge.id}
                className="overflow-hidden border border-slate-200/60 dark:border-slate-800 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 group hover:-translate-y-1"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  {/* Card Header area */}
                  <div className="flex items-start justify-between gap-4">
                    {/* Badge Icon Backdrop */}
                    <div className={`p-3 rounded-xl border ${themeColors.border} ${themeColors.bg} shrink-0 group-hover:rotate-6 transition-transform duration-300`}>
                      <IconComponent className={`h-6 w-6 ${themeColors.text}`} />
                    </div>
                    {/* Difficulty Badge */}
                    <UIPropsBadge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${getDifficultyBadge(badge.difficulty)}`}>
                      {badge.difficulty}
                    </UIPropsBadge>
                  </div>

                  {/* Card Body area */}
                  <div className="space-y-1.5 flex-1">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-250">
                      {badge.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium line-clamp-2">
                      {badge.description}
                    </p>
                  </div>

                  {/* Card Footer area */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                    <span className="uppercase tracking-widest text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850">
                      {badge.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-rose-500" />
                      <span>{badge.earnedDate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <Award className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350">No badges found</h4>
          <p className="text-xs text-slate-500 mt-1">Try selecting a different filter category to view unlocked milestones.</p>
        </div>
      )}
    </div>
  );
}
