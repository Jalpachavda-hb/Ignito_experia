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

import { getApiOrigin } from '@/config/env'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const location = useLocation()
  const { auth } = useAuthStore()
  const [tenantBranding, setTenantBranding] = useState<{ name?: string; logoUrl?: string } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const apiOrigin = getApiOrigin()
      fetch(`${apiOrigin}/api/tenant/resolve`, {
        headers: { 'X-Tenant-Domain': host }
      })
        .then(res => res.json())
        .then(resData => {
          let data = resData
          if (resData?.payload) {
            try {
              data = JSON.parse(atob(resData.payload))
            } catch (e) {}
          }
          if (data?.success && data?.isTenant && data?.tenant) {
            setTenantBranding(data.tenant)
          }
        })
        .catch(() => {})
    }
  }, [])

  const isStudentRoute = location.pathname.startsWith('/student')
  const currentSidebarData = isStudentRoute ? getStudentSidebarData() : sidebarData

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
