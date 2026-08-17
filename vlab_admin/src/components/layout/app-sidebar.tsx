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

import { fetchTenantResolve } from '@/Utils/GetApiHandler'
import { getStudentPurchasedProgrammes, getSemesterCourseListByProgrammeId } from '@/Utils/lmsApi_paths'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const location = useLocation()
  const { auth } = useAuthStore()
  const [tenantBranding, setTenantBranding] = useState<{ name?: string; logoUrl?: string } | null>(null)
  const [lmsPrograms, setLmsPrograms] = useState<any[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      fetchTenantResolve(host)
        .then((resData: any) => {
          let data = resData
          if (resData?.payload) {
            try {
              data = JSON.parse(atob(resData.payload))
            } catch (e) { }
          }
          if (data?.success && data?.isTenant && data?.tenant) {
            setTenantBranding(data.tenant)
          }
        })
        .catch(() => { })
    }
  }, [])

  // Execute 2-Step LMS API Flow for Student Academic Courses & Semesters
  useEffect(() => {
    const isStudentRoute = location.pathname.startsWith('/student')
    if (!isStudentRoute || !auth.user) return

    const studentId = auth.user.studentId || (auth.user as any).StudentDegreeAdmissionId || (auth.user as any).externalStudentId || auth.user.userId
    if (!studentId) return

    // Step 1: Call API No 5 (GetStudentPurchasedProgrammeSemesterList) using studentId
    getStudentPurchasedProgrammes(studentId)
      .then(async (res: any) => {
        const rawProgs = res?.programmeList || res?.rawData?.programmeList || []
        const rawSems = res?.semesterList || res?.rawData?.semesterList || []

        if (!rawProgs || rawProgs.length === 0) return

        // Step 2: For each program, pass programId to API No 3 (GetSemesterCourseListByProgrammeId)
        const detailedPrograms = await Promise.all(
          rawProgs.map(async (prog: any) => {
            const pid = prog.programId || prog.programmeId
            let progSemesters: any[] = []

            // Filter semesters from Step 1 response matching programId
            if (rawSems && rawSems.length > 0) {
              progSemesters = rawSems.filter((s: any) => String(s.programId || s.programmeId) === String(pid))
            }

            // Step 2 API Call: Fetch detailed semester course list for this programmeId
            if (pid) {
              try {
                const semRes: any = await getSemesterCourseListByProgrammeId(pid)
                const semListFromApi = semRes?.semesterList || semRes?.rawData?.semesterList || []
                if (semListFromApi && semListFromApi.length > 0) {
                  if (progSemesters && progSemesters.length > 0) {
                    const purchasedSemNumbers = new Set(progSemesters.map((s: any) => String(s.semesterNumber || s.semesterId)))
                    const filtered = semListFromApi.filter((s: any) => purchasedSemNumbers.has(String(s.semesterNumber || s.semesterId)))
                    if (filtered.length > 0) {
                      progSemesters = filtered
                    }
                  } else {
                    progSemesters = semListFromApi
                  }
                }
              } catch (e) { }
            }

            return {
              ...prog,
              programId: pid,
              programName: prog.programName || prog.programmeNameAndCode || 'Degree Program',
              semesters: progSemesters
            }
          })
        )

        setLmsPrograms(detailedPrograms)
      })
      .catch(() => { })
  }, [auth.user, location.pathname])

  const isStudentRoute = location.pathname.startsWith('/student')
  const currentSidebarData = isStudentRoute ? getStudentSidebarData(lmsPrograms) : sidebarData

  const activeUser = auth.user ? {
    name: auth.user.fullName || auth.user.name || (auth.user.email ? auth.user.email.split('@')[0] : (auth.user.role || 'Super Admin')),
    email: auth.user.email || 'admin@vlab.enterprise',
    avatar: auth.user.profileImage || auth.user.avatar || ''
  } : (currentSidebarData?.user || { name: 'Admin', email: 'admin@vlab.enterprise', avatar: '' });

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <div className="flex items-center justify-center px-3 py-4 border-b border-sidebar-border/40">
          {tenantBranding?.logoUrl ? (
            <img
              src={tenantBranding.logoUrl}
              alt={tenantBranding.name || 'University Logo'}
              className="h-12 max-h-14 w-auto max-w-[190px] object-contain transition-all group-data-[collapsible=icon]:hidden"
            />
          ) : (
            <img
              src="/images/logo.png"
              alt="ignitolearn"
              className="h-12 max-h-14 w-auto max-w-[190px] object-contain transition-all group-data-[collapsible=icon]:hidden"
            />
          )}
          <img src="/images/favicon.png" alt="icon" className="h-8 w-8 object-contain hidden group-data-[collapsible=icon]:block" />
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
