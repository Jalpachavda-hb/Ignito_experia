import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Skeleton } from '@/components/ui/skeleton';

// API Fetchers
import {
  getSummaryStats,
  getStudentBadges,
  getUpcomingBadges,
  getSkillProgress,
  getStudentAchievements,
  getAcademicMilestones,
  getStudentLeaderboard,
  getRecentAchievements,
} from './api';

// Components
import { SummaryCards } from './components/summary-cards';
import { FeaturedBadge } from './components/featured-badge';
import { BadgeGrid } from './components/badge-grid';
import { SkillMasteryTracker } from './components/skill-mastery';
import { LabAchievementsList } from './components/lab-achievements';
import { CreditAchievementsList } from './components/credit-achievements';
import { AcademicMilestonesTimeline } from './components/academic-milestones';
import { LeaderboardPerformance } from './components/leaderboard-perf';
import { UpcomingBadgesList } from './components/upcoming-badges';
import { RecentAchievementTimeline } from './components/recent-timeline';

import { useLabStore } from '@/stores/labStore';

// TypeScript interfaces
import {
  SummaryStats,
  Badge as BadgeType,
  SkillMastery,
  LabAchievement,
  CreditAchievement,
  AcademicMilestone,
  LeaderboardPerf,
  RecentAchievement,
} from './types';

export default function BadgesAchievementsPage() {
  const { labs, loadLabs } = useLabStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [upcomingBadges, setUpcomingBadges] = useState<BadgeType[]>([]);
  const [skills, setSkills] = useState<SkillMastery[]>([]);
  const [labAchievements, setLabAchievements] = useState<LabAchievement[]>([]);
  const [creditAchievements, setCreditAchievements] = useState<CreditAchievement[]>([]);
  const [milestones, setMilestones] = useState<AcademicMilestone[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPerf | null>(null);
  const [timeline, setTimeline] = useState<RecentAchievement[]>([]);

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  const realLabBadges: BadgeType[] = React.useMemo(() => {
    if (!labs || labs.length === 0) return badges;

    return labs.map((lab: any, idx: number) => {
      const name = lab.title || lab.name || 'Virtual Lab';
      const cat = lab.category || 'Programming';
      const desc = lab.description || `Practical virtual lab environment for ${name}.`;

      return {
        id: lab.id || lab.labId || `lab-badge-${idx}`,
        name: name,
        description: desc,
        category: cat,
        iconUrl: lab.logo || lab.image || lab.icon || '',
        earnedDate: 'Assigned Lab',
        difficulty: lab.credits ? `${lab.credits} Credits` : 'Practical',
        isUnlocked: true,
      };
    });
  }, [labs, badges]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        // Load data in parallel
        const [
          resStats,
          resBadges,
          resUpcoming,
          resSkills,
          resAchievements,
          resMilestones,
          resLeaderboard,
          resTimeline,
        ] = await Promise.all([
          getSummaryStats(),
          getStudentBadges(),
          getUpcomingBadges(),
          getSkillProgress(),
          getStudentAchievements(),
          getAcademicMilestones(),
          getStudentLeaderboard(),
          getRecentAchievements(),
        ]);

        setStats(resStats);
        setBadges(resBadges);
        setUpcomingBadges(resUpcoming);
        setSkills(resSkills);
        setLabAchievements(resAchievements.lab);
        setCreditAchievements(resAchievements.credit);
        setMilestones(resMilestones);
        setLeaderboard(resLeaderboard);
        setTimeline(resTimeline);
      } catch (error) {
        console.error('Failed to load achievement data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  return (
    <>
      {/* Header with Breadcrumb */}
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Dashboard</span>
            <span className="text-border">/</span>
            <span className="text-slate-900 dark:text-white font-semibold">Achievements</span>
          </div>
        </div>
      </Header>

      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full px-4 md:px-6 xl:px-10 py-6 space-y-6 max-w-[1600px] mx-auto">
          
          {/* Header Title Section */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-905 dark:text-white uppercase">
              Badges & Achievements
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1.5 max-w-3xl font-medium">
              Track your learning milestones, lab accomplishments, skill mastery, and academic achievements.
            </p>
          </div>

          {loading ? (
            /* Skeletal structure for loading states */
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
                ))}
              </div>
              <Skeleton className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <Skeleton className="h-96 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <Skeleton className="h-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="space-y-6">
                  <Skeleton className="h-80 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <Skeleton className="h-96 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Section 1: Summary Statistics */}
              <SummaryCards />

              {/* Section 2: Featured Badge Card */}
              {realLabBadges.length > 0 && <FeaturedBadge badge={realLabBadges[0]} />}

              {/* Badge Grid Collection */}
              <div className="bg-white dark:bg-slate-950 p-6 rounded-[20px] border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 w-full">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  Badge Collection
                </h3>
                <BadgeGrid badges={realLabBadges} />
              </div>

              {/* Commented out as requested: Leaderboard, Lab/Credit Achievements, Skill Mastery, NEP Milestones, Upcoming Badges, Recent Timeline */}
              {/* 
              {leaderboard && <LeaderboardPerformance data={leaderboard} />}
              <LabAchievementsList achievements={labAchievements} />
              <CreditAchievementsList achievements={creditAchievements} />
              <SkillMasteryTracker skills={skills} />
              <AcademicMilestonesTimeline milestones={milestones} />
              <UpcomingBadgesList badges={upcomingBadges} />
              <RecentAchievementTimeline timeline={timeline} />
              */}
            </>
          )}

        </div>
      </Main>
    </>
  );
}
