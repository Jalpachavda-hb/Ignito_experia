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
// import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { getStudentSidebarData } from './data/student-sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const location = useLocation()
  const { auth } = useAuthStore()

  const isStudentRoute = location.pathname.startsWith('/student')
  const currentSidebarData = isStudentRoute ? getStudentSidebarData() : sidebarData

  const activeUser = auth.user ? {
    name: auth.user.fullName || auth.user.email.split('@')[0],
    email: auth.user.email,
    avatar: '/avatars/shadcn.jpg'
  } : currentSidebarData.user;

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <div className="flex items-center justify-center gap-2 px-2 py-4">
          <img src="/images/logo.png" alt="ignitolearn" className="h-16 w-auto object-contain transition-all group-data-[collapsible=icon]:hidden" />
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

