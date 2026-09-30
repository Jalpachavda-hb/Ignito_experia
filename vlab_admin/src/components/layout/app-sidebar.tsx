import { useEffect, useState } from 'react'
import { useLayout } from '@/context/layout-provider'
import { useLocation } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { getStudentSidebarData } from './data/student-sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

import { isDirectStudent, isUniversityStudent } from '@/lib/student-kind'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const location = useLocation()
  const { auth } = useAuthStore()
  const [lmsPrograms, setLmsPrograms] = useState<any[]>([])

  useEffect(() => {
    const isStudentRoute = location.pathname.startsWith('/student')
    if (!isStudentRoute || !auth.user || !isUniversityStudent(auth.user)) {
      setLmsPrograms([])
      return
    }

    const userProgs = (auth.user as any)?.programmesList || (auth.user as any)?.academic?.programmesList || []
    setLmsPrograms(userProgs.map((prog: any) => ({
      ...prog,
      programId: prog.programId || prog.programmeId || '',
      programName: prog.programName || prog.programmeName || prog.programmeNameAndCode,
      semesters: prog.semesters || [],
      currentSemester: prog.currentSemester,
    })))
  }, [auth.user, location.pathname])

  const isStudentRoute = location.pathname.startsWith('/student')
  const isDirectUser = isDirectStudent(auth.user)
  const currentSidebarData = isStudentRoute ? getStudentSidebarData(lmsPrograms, isDirectUser) : sidebarData

  const activeUser = auth.user ? {
    name: auth.user.fullName || auth.user.name || (auth.user.email ? auth.user.email.split('@')[0] : (auth.user.role || 'Super Admin')),
    email: auth.user.email || 'admin@vlab.enterprise',
    avatar: auth.user.profileImage || auth.user.avatar || ''
  } : (currentSidebarData?.user || { name: 'Admin', email: 'admin@vlab.enterprise', avatar: '' });

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <div className="flex items-center justify-center px-3 py-4 border-b border-sidebar-border/40">
          <img
            src="/images/logo.png"
            alt="Ignito Experia"
            className="h-12 max-h-14 w-auto max-w-[190px] object-contain transition-all group-data-[collapsible=icon]:hidden"
          />
          <img src="/images/logo.png" alt="Ignito Experia" className="h-8 w-8 object-cover object-left hidden group-data-[collapsible=icon]:block" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {currentSidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={activeUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
