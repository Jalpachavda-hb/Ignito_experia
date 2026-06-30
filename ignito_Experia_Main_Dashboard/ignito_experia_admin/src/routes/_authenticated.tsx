import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/services/api'
import { OwnerLayout } from '@/components/layout/owner-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const { accessToken, user, setAuth } = useAuthStore.getState()

    if (accessToken && !user) {
      try {
        const response = await api.get('/auth/me')
        if (response.data?.user) {
          setAuth(response.data.user, accessToken)
        }
      } catch {
        useAuthStore.getState().logout()
        throw redirect({ to: '/sign-in' })
      }
    }

    if (!accessToken) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: () => (
    <OwnerLayout>
      <Outlet />
    </OwnerLayout>
  ),
})
