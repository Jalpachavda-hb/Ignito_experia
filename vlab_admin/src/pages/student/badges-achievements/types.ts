export interface Badge {
  id: string;
  name: string;
  description: string;
  earnedDate?: string;
  category: string;
  difficulty: string;
  progress?: number; // 0 to 100
  isLocked?: boolean;
  iconUrl?: string;
}

export interface SkillMastery {
  skillName: string;
  percentage: number;
}

export interface LabAchievement {
  id: string;
  title: string;
  description: string;
  iconName: string;
  progress: number;
  maxProgress: number;
  isUnlocked: boolean;
}

export interface CreditAchievement {
  id: string;
  title: string;
  description: string;
  iconName: string;
  progress: number;
  maxProgress: number;
  isUnlocked: boolean;
}

export interface AcademicMilestone {
  id: string;
  year: number;
  title: string;
  description: string;
  status: 'Completed' | 'In Progress' | 'Locked';
  eligibleStatus: string; // e.g. "Certificate Eligible", "Diploma Eligible", etc.
}

export interface LeaderboardPerf {
  classRank: number;
  departmentRank: number;
  programRank: number;
  collegeRank: number;
  percentile: number;
  programName: string;
}

export interface RecentAchievement {
  id: string;
  message: string;
  timestamp: string; // relative string e.g. "2 hours ago" or absolute date
  iconName: string;
  category: 'badge' | 'lab' | 'credit' | 'milestone' | 'general';
}

export interface SummaryStats {
  totalBadges: number;
  labsCompleted: number;
  skillScore: number;
  creditsEarned: number;
  currentRank: string;
  achievementPoints: number;
}
