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

  // Execute 2-Step LMS API Flow for Student Academic Courses & Semesters (LMS Students only)
  useEffect(() => {
    const isStudentRoute = location.pathname.startsWith('/student')
    if (!isStudentRoute || !auth.user) return

    const isLmsStudent = Boolean(
      auth.user.createdFrom === 'LMS' || 
      auth.user.authType === 'LMS' || 
      auth.user.authType === 'LMS_AND_DIRECT' || 
      auth.user.studentDegreeAdmissionId || 
      (auth.user as any).externalStudentId ||
      (auth.user as any).programName
    )
    if (!isLmsStudent) {
      setLmsPrograms([])
      return
    }

    const studentId = auth.user.studentId || (auth.user as any).StudentId || auth.user.userId

    // Step 1: Call API No 5 (GetStudentPurchasedProgrammeSemesterList) using studentId
    getStudentPurchasedProgrammes(studentId)
      .then(async (res: any) => {
        const apiProgs = res?.programmeList || res?.programList || res?.rawData?.programmeList || res?.rawData?.programList || []
        const userProgs = (auth.user as any)?.programmesList || (auth.user as any)?.academic?.programmesList || []
        const rawSems = res?.semesterList || res?.rawData?.semesterList || []

        const progMap = new Map<string, any>()
        
        for (const p of userProgs) {
          const key = (p.programName || p.programmeNameAndCode || p.programCode || '').toLowerCase().trim()
          if (key) progMap.set(key, { ...p, programName: p.programName || p.programmeNameAndCode })
        }

        for (const p of apiProgs) {
          const key = (p.programName || p.programmeNameAndCode || p.programCode || '').toLowerCase().trim()
          if (key) {
            const existing = progMap.get(key) || {}
            progMap.set(key, { ...existing, ...p, programName: p.programName || p.programmeNameAndCode || existing.programName })
          } else {
            progMap.set(`prog_${progMap.size}`, p)
          }
        }

        let rawProgs = Array.from(progMap.values())

        if ((!rawProgs || rawProgs.length === 0) && (auth.user as any)?.programName) {
          rawProgs = [{
            programId: 1,
            programName: (auth.user as any).programName,
            semesters: [{ semesterNumber: (auth.user as any).currentSemester || 1 }]
          }]
        }

        if (!rawProgs || rawProgs.length === 0) return

        // Step 2: For each program, pass programId to API No 3 (GetSemesterCourseListByProgrammeId)
        const detailedPrograms = await Promise.all(
          rawProgs.map(async (prog: any) => {
            const pid = prog.programId || prog.programmeId || 1
            let progSemesters: any[] = prog.semesters || []

            if (rawSems && rawSems.length > 0) {
              progSemesters = rawSems.filter((s: any) => String(s.programId || s.programmeId) === String(pid))
            }

            if (pid && progSemesters.length === 0) {
              try {
                const semRes: any = await getSemesterCourseListByProgrammeId(pid)
                const semListFromApi = semRes?.semesterList || semRes?.rawData?.semesterList || []
                if (semListFromApi && semListFromApi.length > 0) {
                  progSemesters = semListFromApi
                }
              } catch (e) { }
            }

            return {
              ...prog,
              programId: pid,
              programName: prog.programName || prog.programmeNameAndCode || 'Degree Program',
              semesters: progSemesters && progSemesters.length > 0 ? progSemesters : [{ semesterNumber: (prog as any).currentSemester || 1 }]
            }
          })
        )

        setLmsPrograms(detailedPrograms)
      })
      .catch(() => {
        const userProgs = (auth.user as any)?.programmesList || (auth.user as any)?.academic?.programmesList || []
        if (userProgs.length > 0) {
          setLmsPrograms(userProgs.map((p: any) => ({
            ...p,
            programName: p.programName || p.programmeNameAndCode,
            semesters: p.semesters || [{ semesterNumber: p.currentSemester || 1 }]
          })))
        } else if ((auth.user as any)?.programName) {
          setLmsPrograms([{
            programId: 1,
            programName: (auth.user as any).programName,
            semesters: [{ semesterNumber: (auth.user as any).currentSemester || 1 }]
          }])
        }
      })
  }, [auth.user?.userId, auth.user?.programName, (auth.user as any)?.programmesList?.length, location.pathname])

  const isStudentRoute = location.pathname.startsWith('/student')
  const isDirectUser = auth.user ? Boolean(
    auth.user.createdFrom === 'DIRECT' && 
    auth.user.authType === 'DIRECT' && 
    !auth.user.studentDegreeAdmissionId && 
    !(auth.user as any).externalStudentId && 
    !(auth.user as any).programName
  ) : false;
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
