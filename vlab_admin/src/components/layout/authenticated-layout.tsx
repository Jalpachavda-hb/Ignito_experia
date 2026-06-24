import { Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { useAuthStore } from '@/stores/auth-store'
import { apiRequest } from '@/lib/apiClient'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const location = useLocation()
  const isComputeRoute = location.pathname.startsWith('/admin/compute')
  const { auth } = useAuthStore()

  // Bootstrap: if token exists but user is null (page refresh), restore from /auth/me
  useEffect(() => {
    if (auth.accessToken && !auth.user) {
      apiRequest('/auth/me', { auth: true })
        .then((data: any) => {
          if (data?.user) {
            auth.setUser({
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
          }
        })
        .catch(() => {
          // Token invalid — reset will happen via 401 handler in apiClient
        })
    }
  }, [auth.accessToken])

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          {!isComputeRoute && <AppSidebar />}
          <SidebarInset
            className={cn(
              isComputeRoute ? 'h-svh p-0 m-0 w-full overflow-hidden' : cn(
                // Set content container, so we can use container queries
                '@container/content',

                // If layout is fixed, set the height
                // to 100svh to prevent overflow
                'has-data-[layout=fixed]:h-svh',

                // If layout is fixed and sidebar is inset,
                // set the height to 100svh - spacing (total margins) to prevent overflow
                'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
              )
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
