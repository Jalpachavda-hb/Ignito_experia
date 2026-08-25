import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { hasPermission } from '@/lib/permissions'

const pathPermissions: Record<string, string> = {
  '/users': 'USER_MANAGEMENT',
  '/labs': 'LAB_MANAGEMENT',
  '/programs': 'PROGRAM_MANAGEMENT',
  '/courses': 'PROGRAM_MANAGEMENT',
  '/semesters': 'SEMESTER_MANAGEMENT',
  '/credits': 'CREDIT_MANAGEMENT',
  '/reports': 'REPORTS',
  '/settings': 'SETTINGS',
  '/sessions': 'SESSION_MONITORING',
  '/audit-logs': 'SETTINGS',
  '/transactions': 'CREDIT_MANAGEMENT'
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    let { accessToken, user } = useAuthStore.getState().auth

    // If user token is expired, clear user state
    if (user && user.exp) {
      const expMs = user.exp < 10000000000 ? user.exp * 1000 : user.exp
      if (expMs < Date.now()) {
        useAuthStore.getState().auth.reset()
        user = null
        accessToken = ''
      }
    }

    // 1. Verify tenant subdomain validity if on custom subdomain
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const parts = host.split('.')
      if (parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost') {
        try {
          const { fetchTenantResolve } = await import('@/Utils/GetApiHandler')
          const resData: any = await fetchTenantResolve(host)
          let data = resData
          if (resData?.payload) {
            try { data = JSON.parse(atob(resData.payload)) } catch (e) {}
          }
          if (data && data.success === false && (data.code === 'TENANT_NOT_FOUND' || data.code === 'TENANT_INACTIVE')) {
            useAuthStore.getState().auth.reset()
            throw redirect({
              to: '/sign-in',
              search: { redirect: location.pathname }
            })
          }
        } catch (err: any) {
          if (err?.to) throw err
        }
      }
    }

    // 2. Validate session & user token against backend DB
    if (accessToken) {
      try {
        const { fetchAuthMe } = await import('@/Utils/GetApiHandler')
        const data: any = await fetchAuthMe()
        if (data?.user) {
          useAuthStore.getState().auth.setUser({
            ...data.user,
            userId: data.user.id || data.user.userId,
            fullName: data.user.fullName || data.user.name,
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
          })
          user = useAuthStore.getState().auth.user
        }
      } catch (err: any) {
        // Only reset if backend explicitly rejects authentication with 401
        if (err?.status === 401 || err?.statusCode === 401 || err?.message?.includes('unauthorized')) {
          useAuthStore.getState().auth.reset()
          user = null
          accessToken = ''
        }
      }
    }

    if (!accessToken || !user) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.pathname,
        },
      })
    }

    const userRole = (user.role || '').toLowerCase();
    const isStudent = userRole === 'student';
    const path = location.pathname;

    const isStudentPath = path.startsWith('/student');
    const isComputePath = path.startsWith('/admin/compute');

    if (isStudent) {
      if (path === '/') {
        throw redirect({ to: '/student/dashboard' })
      }
      const isDirectUser = Boolean(
        user.createdFrom === 'DIRECT' || 
        (user.authType === 'DIRECT' && !user.studentDegreeAdmissionId && !(user as any).externalStudentId && user.createdFrom !== 'LMS')
      );
      if (isDirectUser && path.startsWith('/student/academic-progress')) {
        throw redirect({ to: '/student/dashboard' })
      }
      if (!isStudentPath && !isComputePath && path !== '/403' && path !== '/404') {
        toast.error('Access Denied: You do not have permission to view that page.')
        throw redirect({ to: '/student/dashboard' })
      }
    } else {
      if (isStudentPath) {
        toast.error('Access Denied: You do not have permission to view that page.')
        throw redirect({ to: '/' })
      }

      // Dynamic permission guard for admin / faculty paths
      const matchedPrefix = Object.keys(pathPermissions).find(
        (prefix) => path === prefix || path.startsWith(prefix + '/')
      )

      if (matchedPrefix) {
        const requiredModule = pathPermissions[matchedPrefix]
        if (!hasPermission(requiredModule, 'read')) {
          toast.error('Access Denied: You do not have permission to view that page.')
          throw redirect({ to: '/403' })
        }
      }
    }
  },
  component: AuthenticatedLayout,
})

