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

export function getStudentSidebarData(lmsPrograms?: any[], isDirectUser?: boolean): SidebarData {
  const { student } = dashboardData

  let academicCourseItems: any[] = [];

  if (!isDirectUser && lmsPrograms && Array.isArray(lmsPrograms) && lmsPrograms.length > 0) {
    const programmeMenus = lmsPrograms.map((prog: any) => {
      const semesterSource = (prog.semesters && Array.isArray(prog.semesters) && prog.semesters.length > 0)
        ? prog.semesters
        : (prog.currentSemester != null && prog.currentSemester !== ''
            ? [{ semesterNumber: prog.currentSemester }]
            : []);
      const sems = semesterSource.map((s: any) => ({
        title: `Semester ${s.semesterNumber || s.semesterId || s}`,
        url: `/student/my-labs?programId=${encodeURIComponent(String(prog.programId || prog.programmeId || ''))}&semester=${encodeURIComponent(String(s.semesterNumber || s.semesterId || s))}`
      }));

      return {
        title: prog.programName || prog.programmeName || prog.programmeNameAndCode || 'Degree Program',
        items: sems
      };
    }).filter((prog: any) => prog.items.length > 0);

    if (programmeMenus.length > 0) {
      academicCourseItems = [{
        title: 'Academic Courses',
        icon: GraduationCap,
        items: programmeMenus,
      }];
    }
  }

  const mainItems: any[] = [
    {
      title: 'Dashboard',
      url: '/student/dashboard',
      icon: LayoutDashboard,
    },
    ...academicCourseItems,
  ];

  if (!isDirectUser) {
    mainItems.push({
      title: 'Academic Progress',
      url: '/student/academic-progress',
      icon: Activity,
    });
  }

  mainItems.push(
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
    {
      title: 'Profile',
      url: '/student/profile',
      icon: User,
    },
  );

  const navGroups: any[] = [
    {
      title: 'Main Menu',
      items: mainItems,
    },
    {
      title: 'Academics',
      items: [
        {
          title: 'Badges & Achievements',
          url: '/student/badges-achievements',
          icon: Award,
        },
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
