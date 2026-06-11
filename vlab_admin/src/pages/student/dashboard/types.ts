// Types for student dashboard components
export interface ProgramInfo {
  id: string
  name: string
  totalSemesters: number
  currentSemester: number
  overallProgress: number // percentage
  startDate: string
  expectedEndDate: string
}

export interface StudentProfile {
  id: string
  name: string
  enrollmentNumber: string
  email: string
  mobile: string
  alternateMobile?: string
  gender?: string
  dateOfBirth?: string
  address?: string
  city?: string
  state?: string
  country?: string
  collegeName: string
  department?: string
  admissionYear?: number
  studentType?: 'Regular' | 'Distance Learning' | 'Part-Time'
  avatar: string
  username?: string
  accountCreatedDate?: string
  lastLogin?: string
  passwordLastChanged?: string
  twoFactorEnabled?: boolean
  emailVerified?: boolean
  mobileVerified?: boolean
  program: ProgramInfo
  academicStatus: 'Good Standing' | 'Warning' | 'Probation'
}

export interface CreditWallet {
  totalCredits: number
  usedCredits: number
  remainingCredits: number
  allocatedCredits?: number
  consumptionData?: { name: string; value: number }[] // For mini trend chart
}

export interface LabActivity {
  id: string
  labName: string
  status: 'Completed' | 'In Progress' | 'Not Started'
  creditsUsed: number
  completionPercentage: number
  lastAccessed: string
  timeSpent?: string
  performanceScore?: number
}

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'Credit' | 'Debit'
}

export interface AcademicMilestone {
  id: string
  year: number
  title: string
  status: 'Completed' | 'In Progress' | 'Pending'
  description: string
}

export interface Notification {
  id: string
  type: 'Lab' | 'Credit' | 'Certificate' | 'Academic' | 'Deadline'
  title: string
  message: string
  date: string
  isRead: boolean
}

export interface SemesterPerformanceData {
  semester: string
  averageMarks: number
}

export interface WeeklyActivityData {
  day: string
  labsCompleted: number
  hoursPracticed: number
  creditsConsumed: number
}

export interface CurrentCourse {
  id: string
  subjectName: string
  progressPercentage: number
  totalModules: number
  completedModules: number
}

export interface Certificate {
  id: string
  title: string
  issueDate: string
  certificateId: string
  issuedBy: string
  program: string
  status: 'Issued' | 'Verified' | 'Pending' | 'Expired'
  type: 'Lab' | 'Academic' | 'Program'
}

export interface DashboardData {
  student: StudentProfile
  wallet: CreditWallet
  recentLabs: LabActivity[]
  transactions: Transaction[]
  milestones: AcademicMilestone[]
  notifications: Notification[]
  certificatesEarned: number
  certificates: Certificate[]
  completedLabs: number
  currentGPA: number
  attendancePercentage: number
  semesterPerformance: SemesterPerformanceData[]
  weeklyActivity: WeeklyActivityData[]
  mostPracticedLabs: LabActivity[]
  currentCourses: CurrentCourse[]
  academicOverviewStats: {
    completedLabs: number
    inProgressLabs: number
    pendingLabs: number
    totalLabs: number
  }
}
