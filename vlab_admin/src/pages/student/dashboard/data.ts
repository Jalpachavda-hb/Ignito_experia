import { DashboardData } from './types'

export const dashboardData: DashboardData = {
  student: {
    id: 'STU-2024-001',
    name: 'Rahul Sharma',
    enrollmentNumber: 'ENR-2024-MCA-042',
    email: 'rahul.sharma@student.university.edu',
    mobile: '+91 98765 43210',
    alternateMobile: '+91 91234 56789',
    gender: 'Male',
    dateOfBirth: '1998-05-14',
    address: '42, Tech Park Avenue, Knowledge City',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    collegeName: 'College of Computing & Technology',
    department: 'Computer Applications',
    admissionYear: 2023,
    studentType: 'Regular',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    username: 'rahul.sharma.mca',
    accountCreatedDate: '2023-07-15T08:30:00Z',
    lastLogin: '2024-03-20T10:15:22Z',
    passwordLastChanged: '2024-01-10T14:20:00Z',
    twoFactorEnabled: true,
    emailVerified: true,
    mobileVerified: true,
    academicStatus: 'Good Standing',
    program: {
      id: 'MCA-01',
      name: 'Master of Computer Applications (MCA)',
      totalSemesters: 4,
      currentSemester: 3,
      overallProgress: 65,
      startDate: '2023-08-01',
      expectedEndDate: '2025-06-30'
    }
  },
  wallet: {
    totalCredits: 1200,
    usedCredits: 850,
    remainingCredits: 350,
    allocatedCredits: 1200,
    consumptionData: [
      { name: 'Jan', value: 100 },
      { name: 'Feb', value: 250 },
      { name: 'Mar', value: 450 },
      { name: 'Apr', value: 600 },
      { name: 'May', value: 850 },
    ]
  },
  currentGPA: 8.4,
  attendancePercentage: 92,
  certificatesEarned: 2,
  completedLabs: 14,
  recentLabs: [
    {
      id: 'LAB-101',
      labName: 'Advanced Data Structures: Graph Algorithms',
      status: 'Completed',
      creditsUsed: 50,
      completionPercentage: 100,
      lastAccessed: '2024-03-10T14:30:00Z'
    },
    {
      id: 'LAB-102',
      labName: 'Cloud Computing: Kubernetes Deployment',
      status: 'In Progress',
      creditsUsed: 120,
      completionPercentage: 45,
      lastAccessed: '2024-03-15T09:15:00Z'
    },
    {
      id: 'LAB-103',
      labName: 'Machine Learning: Neural Networks',
      status: 'Not Started',
      creditsUsed: 0,
      completionPercentage: 0,
      lastAccessed: '2024-03-01T11:00:00Z'
    }
  ],
  transactions: [
    {
      id: 'TRX-001',
      date: '2024-03-15',
      description: 'Lab Launch: Cloud Computing',
      amount: 120,
      type: 'Debit'
    },
    {
      id: 'TRX-002',
      date: '2024-03-01',
      description: 'Semester 3 Credit Allocation',
      amount: 500,
      type: 'Credit'
    },
    {
      id: 'TRX-003',
      date: '2024-02-15',
      description: 'Lab Completion Bonus',
      amount: 25,
      type: 'Credit'
    }
  ],
  milestones: [
    {
      id: 'M1',
      year: 1,
      title: 'Year 1 Completed',
      status: 'Completed',
      description: 'Certificate in Computer Applications Earned'
    },
    {
      id: 'M2',
      year: 2,
      title: 'Year 2 In Progress',
      status: 'In Progress',
      description: 'Diploma in progress'
    },
    {
      id: 'M3',
      year: 3,
      title: 'Year 3 Pending',
      status: 'Pending',
      description: 'Bachelor Degree'
    },
    {
      id: 'M4',
      year: 4,
      title: 'Year 4 Pending',
      status: 'Pending',
      description: 'Honours Degree'
    }
  ],
  notifications: [
    {
      id: 'notif-1',
      type: 'Lab',
      title: 'Lab Evaluated',
      message: 'Your Python Basics lab has been evaluated. You scored 92%.',
      date: '2 hours ago',
      isRead: false
    },
    {
      id: 'notif-2',
      type: 'Credit',
      title: 'Credits Added',
      message: '100 credits have been added to your wallet for the new semester.',
      date: '1 day ago',
      isRead: true
    }
  ],
  certificates: [
    {
      id: 'cert-1',
      title: 'Python Programming Lab Certificate',
      issueDate: '2025-12-15',
      certificateId: 'IGN-PY-90821',
      issuedBy: 'IgnitoLearn Labs',
      program: 'Master of Computer Applications',
      status: 'Verified',
      type: 'Lab'
    },
    {
      id: 'cert-2',
      title: 'Java Development Mastery',
      issueDate: '2026-03-10',
      certificateId: 'IGN-JV-34982',
      issuedBy: 'IgnitoLearn Labs',
      program: 'Master of Computer Applications',
      status: 'Issued',
      type: 'Lab'
    },
    {
      id: 'cert-3',
      title: 'Cloud Computing Fundamentals',
      issueDate: '2026-06-01',
      certificateId: 'IGN-CC-11234',
      issuedBy: 'AWS Academy',
      program: 'Master of Computer Applications',
      status: 'Issued',
      type: 'Academic'
    },
    {
      id: 'cert-4',
      title: 'Semester 2 Completion Certificate',
      issueDate: '2026-01-05',
      certificateId: 'IGN-SEM2-88712',
      issuedBy: 'University Registrar',
      program: 'Master of Computer Applications',
      status: 'Verified',
      type: 'Program'
    }
  ],
  semesterPerformance: [
    { semester: 'Semester 1', averageMarks: 68 },
    { semester: 'Semester 2', averageMarks: 74 },
    { semester: 'Semester 3', averageMarks: 81 },
    { semester: 'Semester 4', averageMarks: 0 },
  ],
  weeklyActivity: [
    { day: 'Mon', labsCompleted: 1, hoursPracticed: 2.5, creditsConsumed: 50 },
    { day: 'Tue', labsCompleted: 0, hoursPracticed: 1.0, creditsConsumed: 20 },
    { day: 'Wed', labsCompleted: 2, hoursPracticed: 4.0, creditsConsumed: 120 },
    { day: 'Thu', labsCompleted: 0, hoursPracticed: 0.5, creditsConsumed: 10 },
    { day: 'Fri', labsCompleted: 1, hoursPracticed: 3.0, creditsConsumed: 80 },
    { day: 'Sat', labsCompleted: 3, hoursPracticed: 5.5, creditsConsumed: 200 },
    { day: 'Sun', labsCompleted: 1, hoursPracticed: 2.0, creditsConsumed: 40 },
  ],
  mostPracticedLabs: [
    {
      id: 'PL-1',
      labName: 'Python Programming Essentials',
      status: 'Completed',
      creditsUsed: 150,
      completionPercentage: 100,
      lastAccessed: '2024-03-05T10:00:00Z',
      timeSpent: '12h 30m',
      performanceScore: 92
    },
    {
      id: 'PL-2',
      labName: 'Java Development Workshop',
      status: 'Completed',
      creditsUsed: 220,
      completionPercentage: 100,
      lastAccessed: '2024-02-28T14:15:00Z',
      timeSpent: '18h 45m',
      performanceScore: 88
    }
  ],
  currentCourses: [
    { id: 'C1', subjectName: 'Data Structures', progressPercentage: 80, totalModules: 10, completedModules: 8 },
    { id: 'C2', subjectName: 'Database Management System', progressPercentage: 65, totalModules: 12, completedModules: 8 },
    { id: 'C3', subjectName: 'Operating Systems', progressPercentage: 40, totalModules: 8, completedModules: 3 },
    { id: 'C4', subjectName: 'Java Programming', progressPercentage: 90, totalModules: 10, completedModules: 9 },
    { id: 'C5', subjectName: 'Cloud Computing', progressPercentage: 25, totalModules: 12, completedModules: 3 },
  ],
  academicOverviewStats: {
    completedLabs: 14,
    inProgressLabs: 5,
    pendingLabs: 11,
    totalLabs: 30
  }
}
