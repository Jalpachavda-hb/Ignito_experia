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
import { getPracticalAvailablePrograms, isPracticalAvailableProgram } from '@/Utils/lmsApi_paths'

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

    let isMounted = true

    getPracticalAvailablePrograms()
      .then((res: any) => {
        if (!isMounted) return
        const practicalList = res?.programList || res?.programmeList || res?.rawData?.programList || (Array.isArray(res) ? res : [])
        const userProgs = (auth.user as any)?.programmesList || (auth.user as any)?.academic?.programmesList || []

        let filteredProgs: any[] = []
        if (Array.isArray(practicalList) && practicalList.length > 0) {
          filteredProgs = userProgs.filter((prog: any) => isPracticalAvailableProgram(prog, practicalList))
          if (filteredProgs.length === 0) {
            filteredProgs = practicalList
          }
        } else {
          filteredProgs = userProgs
        }

        const mapped = filteredProgs.map((prog: any) => {
          const matchedPrac = Array.isArray(practicalList) ? practicalList.find((prac: any) => isPracticalAvailableProgram(prog, [prac])) : null
          const totalSems = Number(prog.totalSemesters || matchedPrac?.totalSemesters || 0)
          const fallbackSemesters = totalSems > 0
            ? Array.from({ length: totalSems }, (_, i) => ({ semesterNumber: i + 1 }))
            : (prog.currentSemester != null && prog.currentSemester !== '' ? [{ semesterNumber: prog.currentSemester }] : [{ semesterNumber: 1 }])

          return {
            ...prog,
            ...matchedPrac,
            programId: prog.programId || prog.programmeId || matchedPrac?.programId || matchedPrac?.programmeId || '',
            programName: prog.programName || prog.programmeName || prog.programmeNameAndCode || matchedPrac?.programName || matchedPrac?.programmeName || 'Degree Program',
            semesters: (prog.semesters && Array.isArray(prog.semesters) && prog.semesters.length > 0) ? prog.semesters : fallbackSemesters,
            currentSemester: prog.currentSemester || matchedPrac?.currentSemester || 1,
            totalSemesters: totalSems || 4,
          }
        })

        setLmsPrograms(mapped)

        if (userProgs.length > filteredProgs.length && filteredProgs.length > 0 && auth.user) {
          useAuthStore.getState().auth.setUser({
            ...auth.user,
            programmesList: mapped,
          } as any)
        }
      })
      .catch((err) => {
        console.warn('Failed to load practical available programs in sidebar:', err)
        if (!isMounted) return
        const userProgs = (auth.user as any)?.programmesList || (auth.user as any)?.academic?.programmesList || []
        setLmsPrograms(userProgs.map((prog: any) => ({
          ...prog,
          programId: prog.programId || prog.programmeId || '',
          programName: prog.programName || prog.programmeName || prog.programmeNameAndCode,
          semesters: prog.semesters || [],
          currentSemester: prog.currentSemester,
        })))
      })

    return () => {
      isMounted = false
    }
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
          <img src="/images/favicon.png" alt="Ignito Experia" className="h-8 w-8 object-contain hidden group-data-[collapsible=icon]:block" />
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
