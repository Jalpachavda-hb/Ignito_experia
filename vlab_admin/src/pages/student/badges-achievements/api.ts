import { 
  Badge, 
  SkillMastery, 
  LabAchievement, 
  CreditAchievement,
  AcademicMilestone, 
  LeaderboardPerf, 
  RecentAchievement,
  SummaryStats
} from './types';

// Mock database simulation
const mockSummaryStats: SummaryStats = {
  totalBadges: 24,
  labsCompleted: 18,
  skillScore: 850,
  creditsEarned: 1200,
  currentRank: '#12 in MCA Program',
  achievementPoints: 4250,
};

const mockBadges: Badge[] = [
  {
    id: 'badge-1',
    name: 'Python Expert',
    description: 'Demonstrated mastery in graph algorithms, OOP concepts, and clean Pythonic code writing in virtual labs.',
    earnedDate: '2026-06-10',
    category: 'Programming',
    difficulty: 'Advanced',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-2',
    name: 'Database Specialist',
    description: 'Excelled in optimization, schema design, and advanced indexing configurations in Database Management Systems.',
    earnedDate: '2026-05-28',
    category: 'Database',
    difficulty: 'Advanced',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-3',
    name: 'Linux Administrator',
    description: 'Successfully configured complex system scripts, permissions, and pipeline tools in the Unix environment.',
    earnedDate: '2026-04-12',
    category: 'Linux',
    difficulty: 'Intermediate',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-4',
    name: 'Cloud Practitioner',
    description: 'Successfully deployed serverless clusters and microservices architectures in virtual Kubernetes environments.',
    earnedDate: '2026-03-05',
    category: 'Cloud',
    difficulty: 'Intermediate',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-5',
    name: 'Java Developer',
    description: 'Completed multi-threaded desktop implementations and modular structures with perfect unit test logs.',
    earnedDate: '2026-02-18',
    category: 'Programming',
    difficulty: 'Intermediate',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-6',
    name: 'Data Science Explorer',
    description: 'Constructed regression models and cleaned complex datasets using standard Pandas pipelines in the Jupyter Workspace.',
    earnedDate: '2026-01-20',
    category: 'Data Science',
    difficulty: 'Beginner',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-7',
    name: 'TDD Champion',
    description: 'Wrote unit tests for every function component, achieving 100% test coverage before launching execution containers.',
    earnedDate: '2025-12-05',
    category: 'Software Testing',
    difficulty: 'Advanced',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-8',
    name: 'Design Patterns Guru',
    description: 'Refactored backend legacy blocks with factory and observer models in the software lab exercises.',
    earnedDate: '2025-11-10',
    category: 'Software Engineering',
    difficulty: 'Expert',
    progress: 100,
    isLocked: false,
  },
  {
    id: 'badge-9',
    name: 'API Testing Virtuoso',
    description: 'Configured automated Postman collections and schema validations with zero manual failures.',
    earnedDate: '2025-10-15',
    category: 'Software Testing',
    difficulty: 'Intermediate',
    progress: 100,
    isLocked: false,
  },
];

const mockUpcomingBadges: Badge[] = [
  {
    id: 'ubadge-1',
    name: 'Python Master',
    description: 'Unlock by completing advanced decorator design, asynchronous asyncio scripts, and memory profiler modules.',
    category: 'Programming',
    difficulty: 'Expert',
    progress: 75,
    isLocked: true,
  },
  {
    id: 'ubadge-2',
    name: 'Linux Expert',
    description: 'Unlock by configuring kernel networking modules, shell automation pipelines, and custom security privileges.',
    category: 'Linux',
    difficulty: 'Expert',
    progress: 60,
    isLocked: true,
  },
  {
    id: 'ubadge-3',
    name: 'Database Architect',
    description: 'Unlock by scaling partitioned databases, distributed transaction logs, and replication engines.',
    category: 'Database',
    difficulty: 'Expert',
    progress: 40,
    isLocked: true,
  },
  {
    id: 'ubadge-4',
    name: 'Cloud Engineer',
    description: 'Unlock by managing multi-region load balancers, CDN routing profiles, and terraform infrastructure configuration.',
    category: 'Cloud',
    difficulty: 'Expert',
    progress: 20,
    isLocked: true,
  },
];

const mockSkillProgress: SkillMastery[] = [
  { skillName: 'Python', percentage: 85 },
  { skillName: 'Java', percentage: 70 },
  { skillName: 'Linux', percentage: 90 },
  { skillName: 'SQL', percentage: 80 },
  { skillName: 'Cloud Computing', percentage: 60 },
  { skillName: 'Data Science', percentage: 55 },
];

const mockLabAchievements: LabAchievement[] = [
  {
    id: 'la-1',
    title: 'First Lab Completed',
    description: 'Completed your first practical virtual lab simulation successfully.',
    iconName: 'Sparkles',
    progress: 1,
    maxProgress: 1,
    isUnlocked: true,
  },
  {
    id: 'la-2',
    title: '10 Labs Completed',
    description: 'Acquired hands-on experience in 10 technical virtual labs.',
    iconName: 'ListChecks',
    progress: 10,
    maxProgress: 10,
    isUnlocked: true,
  },
  {
    id: 'la-3',
    title: '25 Labs Completed',
    description: 'Master practical workflows in 25 technical labs.',
    iconName: 'Trophy',
    progress: 18,
    maxProgress: 25,
    isUnlocked: false,
  },
  {
    id: 'la-4',
    title: '50 Labs Completed',
    description: 'Reach the elite milestone of 50 virtual lab completions.',
    iconName: 'Award',
    progress: 18,
    maxProgress: 50,
    isUnlocked: false,
  },
  {
    id: 'la-5',
    title: 'Fast Learner',
    description: 'Completed 5 separate lab modules within a single week.',
    iconName: 'Zap',
    progress: 5,
    maxProgress: 5,
    isUnlocked: true,
  },
  {
    id: 'la-6',
    title: 'Perfect Completion',
    description: 'Achieved a perfect 100% evaluation score in a virtual lab session.',
    iconName: 'CheckCircle2',
    progress: 1,
    maxProgress: 1,
    isUnlocked: true,
  },
  {
    id: 'la-7',
    title: 'Night Owl Coder',
    description: 'Successfully submitted container exercises between 12:00 AM and 4:00 AM.',
    iconName: 'Moon',
    progress: 1,
    maxProgress: 1,
    isUnlocked: true,
  },
];

const mockCreditAchievements: CreditAchievement[] = [
  {
    id: 'ca-1',
    title: 'Earned 100 Credits',
    description: 'Gained your first 100 learning credits through lab tasks.',
    iconName: 'Coins',
    progress: 100,
    maxProgress: 100,
    isUnlocked: true,
  },
  {
    id: 'ca-2',
    title: 'Earned 500 Credits',
    description: 'Accumulated a total of 500 credits across semesters.',
    iconName: 'Award',
    progress: 500,
    maxProgress: 500,
    isUnlocked: true,
  },
  {
    id: 'ca-3',
    title: 'Earned 1000 Credits',
    description: 'Crossed the 1000 credits threshold.',
    iconName: 'Trophy',
    progress: 1200,
    maxProgress: 1000,
    isUnlocked: true,
  },
  {
    id: 'ca-4',
    title: 'Earned 5000 Credits',
    description: 'Accumulate an incredible 5000 total academic credits.',
    iconName: 'ShieldAlert',
    progress: 1200,
    maxProgress: 5000,
    isUnlocked: false,
  },
];

const mockAcademicMilestones: AcademicMilestone[] = [
  {
    id: 'milestone-1',
    year: 1,
    title: 'Year 1 Completed',
    description: 'Completed semesters 1 and 2 with required credits and labs.',
    status: 'Completed',
    eligibleStatus: 'Certificate Eligible',
  },
  {
    id: 'milestone-2',
    year: 2,
    title: 'Year 2 Completed',
    description: 'Completed semesters 3 and 4 with advanced credit requirements.',
    status: 'In Progress',
    eligibleStatus: 'Diploma Eligible',
  },
  {
    id: 'milestone-3',
    year: 3,
    title: 'Year 3 Completed',
    description: 'Earned core degree credits and elective lab checkpoints.',
    status: 'Locked',
    eligibleStatus: 'Bachelor Degree Eligible',
  },
  {
    id: 'milestone-4',
    year: 4,
    title: 'Year 4 Completed',
    description: 'Final research thesis, capstone labs, and honors specialization.',
    status: 'Locked',
    eligibleStatus: 'Honours Degree Eligible',
  },
];

const mockLeaderboard: LeaderboardPerf = {
  classRank: 5,
  departmentRank: 8,
  programRank: 12,
  collegeRank: 45,
  percentile: 90, // Top 10%
  programName: 'MCA Program',
};

const mockRecentAchievements: RecentAchievement[] = [
  {
    id: 'ra-1',
    message: 'Earned Python Expert Badge',
    timestamp: '2 hours ago',
    iconName: 'Award',
    category: 'badge',
  },
  {
    id: 'ra-2',
    message: 'Completed Linux Lab: Graph Pipelines',
    timestamp: '1 day ago',
    iconName: 'FlaskConical',
    category: 'lab',
  },
  {
    id: 'ra-3',
    message: 'Completed Semester 3 Lab Requirements',
    timestamp: '3 days ago',
    iconName: 'GraduationCap',
    category: 'milestone',
  },
  {
    id: 'ra-4',
    message: 'Reached 1200 Total Credits',
    timestamp: '5 days ago',
    iconName: 'Coins',
    category: 'credit',
  },
  {
    id: 'ra-5',
    message: 'Top Performer Achievement Unlocked',
    timestamp: '1 week ago',
    iconName: 'Trophy',
    category: 'general',
  },
];

// Async Mock endpoints mirroring REST API
export async function getSummaryStats(): Promise<SummaryStats> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockSummaryStats), 100);
  });
}

export async function getStudentBadges(): Promise<Badge[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockBadges), 100);
  });
}

export async function getUpcomingBadges(): Promise<Badge[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockUpcomingBadges), 100);
  });
}

export async function getSkillProgress(): Promise<SkillMastery[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockSkillProgress), 100);
  });
}

export async function getStudentAchievements(): Promise<{ lab: LabAchievement[]; credit: CreditAchievement[] }> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ lab: mockLabAchievements, credit: mockCreditAchievements }), 100);
  });
}

export async function getAcademicMilestones(): Promise<AcademicMilestone[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockAcademicMilestones), 100);
  });
}

export async function getStudentLeaderboard(): Promise<LeaderboardPerf> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockLeaderboard), 100);
  });
}

export async function getRecentAchievements(): Promise<RecentAchievement[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockRecentAchievements), 100);
  });
}
