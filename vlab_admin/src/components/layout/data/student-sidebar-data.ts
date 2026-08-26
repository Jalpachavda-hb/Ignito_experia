import {
  LayoutDashboard,
  GraduationCap,
  FlaskConical,
  Wallet,
  ReceiptText,
  Activity,
  Award,
  Trophy,
  User,
  BookOpen
} from 'lucide-react'
import { type SidebarData } from '../types'
import { dashboardData } from '@/pages/student/dashboard/data'

export function getStudentSidebarData(lmsPrograms?: any[], isDirectUser?: boolean): SidebarData {
  const { student } = dashboardData

  let academicCourseItems: any[] = [];

  if (!isDirectUser && lmsPrograms && Array.isArray(lmsPrograms) && lmsPrograms.length > 0) {
    academicCourseItems = lmsPrograms.map((prog: any) => {
      const sems = (prog.semesters && Array.isArray(prog.semesters) && prog.semesters.length > 0)
        ? prog.semesters.map((s: any) => ({
          title: `Semester ${s.semesterNumber || s.semesterId || s}`,
          url: `/student/my-labs?programId=${prog.programId || ''}&semester=${s.semesterNumber || s.semesterId || s}`
        }))
        : [{
          title: `Semester 1`,
          url: `/student/my-labs?programId=${prog.programId || ''}&semester=1`
        }];

      return {
        title: prog.programName || prog.programmeNameAndCode || 'Degree Program',
        icon: GraduationCap,
        items: sems
      };
    });
  } else {
    academicCourseItems = [];
  }

  const academicItems = isDirectUser
    ? [
        {
          title: 'Badges & Achievements',
          url: '/student/badges-achievements',
          icon: Award,
        },
        {
          title: 'Profile',
          url: '/student/profile',
          icon: User,
        },
      ]
    : [
        {
          title: 'Academic Progress',
          url: '/student/academic-progress',
          icon: Activity,
        },
        {
          title: 'Badges & Achievements',
          url: '/student/badges-achievements',
          icon: Award,
        },
        {
          title: 'Profile',
          url: '/student/profile',
          icon: User,
        },
      ];

  const navGroups: any[] = [
    {
      title: 'Main Menu',
      items: [
        {
          title: 'Dashboard',
          url: '/student/dashboard',
          icon: LayoutDashboard,
        },
        {
          title: 'Lab Catalogue',
          url: '/student/lab-catalogue',
          icon: BookOpen,
        },
        {
          title: 'My Labs',
          url: '/student/my-labs',
          icon: FlaskConical,
        },
        {
          title: 'Token Wallet',
          url: '/student/credit-wallet',
          icon: Wallet,
        },
        {
          title: 'Transactions',
          url: '/student/transactions',
          icon: ReceiptText,
        },
      ],
    },
    {
      title: 'Academics',
      items: [
        ...academicItems,
        ...academicCourseItems
      ]
    }
  ];

  return {
    user: {
      name: student.name,
      email: student.email,
      avatar: student.avatar,
    },
    teams: [],
    navGroups,
  }
}
