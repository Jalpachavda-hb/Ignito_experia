import {
  LayoutDashboard,
  GraduationCap,
  FlaskConical,
  Wallet,
  ReceiptText,
  Activity,
  Award,
  User,
  BookOpen
} from 'lucide-react'
import { type SidebarData } from '../types'
import { dashboardData } from '@/pages/student/dashboard/data'

export function getStudentSidebarData(): SidebarData {
  const { student } = dashboardData

  // Generate dynamic semester list based on the total semesters in the program
  const semesterItems = Array.from({ length: student.program.totalSemesters }).map((_, i) => ({
    title: `Semester ${i + 1}`,
    url: `/student/my-labs?semester=${i + 1}`
  }))

  return {
    user: {
      name: student.name,
      email: student.email,
      avatar: student.avatar,
    },
    teams: [],
    navGroups: [
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
            title: 'Credit Wallet',
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
          {
            title: 'Academic Progress',
            url: '/student/academic-progress',
            icon: Activity,
          },
          {
            title: 'Certificates',
            url: '/student/certificates',
            icon: Award,
          },
          {
            title: 'Profile',
            url: '/student/profile',
            icon: User,
          },
        ]
      },
      {
        title: 'Academic Courses',
        items: [
          {
            title: student.program.name.split(' (')[0] || student.program.name, // e.g. Master of Computer Applications
            icon: GraduationCap,
            items: semesterItems
          }
        ]
      }
    ],
  }
}
