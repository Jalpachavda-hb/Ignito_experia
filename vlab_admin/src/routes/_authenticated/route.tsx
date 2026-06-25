import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { hasPermission } from '@/lib/permissions'

const pathPermissions: Record<string, string> = {
  '/roles': 'ROLE_MANAGEMENT',
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
    
    // If we have an access token but no user (page refresh), try to restore the user state before deciding to redirect.
    if (accessToken && !user) {
      try {
        const { apiRequest } = await import('@/lib/apiClient')
        const data = await apiRequest('/auth/me', { auth: true })
        if (data?.user) {
          useAuthStore.getState().auth.setUser({
            userId: data.user.id,
            fullName: data.user.fullName || data.user.name,
            email: data.user.email,
            role: data.user.role,
            roleId: data.user.roleId,
            status: data.user.status,
            programId: data.user.programId,
            semesterId: data.user.semesterId,
            permissions: data.user.permissions,
            exp: Date.now() + 24 * 60 * 60 * 1000,
          })
          user = useAuthStore.getState().auth.user
        }
      } catch (err) {
        // API client might handle token refresh. If it fails, user will be redirected.
      }
    }

    if (!accessToken || !user) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }
    
    const userRole = user.role;
    const path = location.pathname;

    const isStudentPath = path.startsWith('/student');
    const isComputePath = path.startsWith('/admin/compute');

    if (userRole === 'Student') {
      if (path === '/') {
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

