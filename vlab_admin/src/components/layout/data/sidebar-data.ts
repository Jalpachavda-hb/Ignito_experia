import {
  LayoutDashboard,
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
  ScrollText,
  Settings,
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
  ],
}
