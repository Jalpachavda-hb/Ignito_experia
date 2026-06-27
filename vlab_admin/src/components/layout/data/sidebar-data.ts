import {
  LayoutDashboard,
  LineChart,
  Users,
  Shield,
  GraduationCap,
  BookOpen,
  Layers,
  FlaskConical,
  Activity,
  Wallet,
  ReceiptText,
  FileText,
  Bell,
  ScrollText,
  Settings,
  Server,
  User,
  BookMarked,
  Award,
  UserCheck,
  UserCog,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin',
    email: 'admin@vlab.enterprise',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [],
  navGroups: [
    {
      title: 'Observability',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
          // Dashboard is always visible — no moduleCode filter
        },
      ],
    },
    {
      title: 'Compute & Labs',
      items: [
        {
          title: 'Lab Management',
          url: '/labs',
          icon: FlaskConical,
          moduleCode: 'LAB_MANAGEMENT',
        },
        {
          title: 'Session Monitoring',
          url: '/sessions',
          icon: Activity,
          moduleCode: 'SESSION_MONITORING',
        },
      ],
    },
    {
      title: 'Identity & Access',
      items: [
        {
          title: 'User Management',
          url: '/users',
          icon: Users,
          moduleCode: 'USER_MANAGEMENT',
        },
        {
          title: 'Role Management',
          url: '/roles',
          icon: Shield,
          moduleCode: 'ROLE_MANAGEMENT',
        },
      ],
    },

    {
      title: 'Academic',
      items: [
        {
          title: 'Programs',
          url: '/programs',
          icon: GraduationCap,
          moduleCode: 'PROGRAM_MANAGEMENT',
        },
        {
          title: 'Courses',
          url: '/courses',
          icon: BookOpen,
          moduleCode: 'COURSE_MANAGEMENT',
        },
        {
          title: 'Semesters',
          url: '/semesters',
          icon: Layers,
          moduleCode: 'SEMESTER_MANAGEMENT',
        },
      ],
    },
    {
      title: 'Billing & Compliance',
      items: [
        {
          title: 'Credit Management',
          url: '/credits',
          icon: Wallet,
          moduleCode: 'CREDIT_MANAGEMENT',
        },
        {
          title: 'Transactions',
          url: '/transactions',
          icon: ReceiptText,
          moduleCode: 'TRANSACTION_MANAGEMENT',
        },
        {
          title: 'Reports',
          url: '/reports',
          icon: FileText,
          moduleCode: 'REPORTS',
        },
        {
          title: 'Audit Logs',
          url: '/audit-logs',
          icon: ScrollText,
          moduleCode: 'SETTINGS',
        },
      ],
    },
    {
      title: 'Configuration',
      items: [
        {
          title: 'Settings',
          url: '/settings',
          icon: Settings,
          moduleCode: 'SETTINGS',
        },
      ],
    },
  ],
}
