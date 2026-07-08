import { Link, useLocation } from '@tanstack/react-router'
import {
  BarChart3, Building2, CreditCard,
  FlaskConical, LayoutDashboard, LogOut, Receipt, Settings,
  TrendingUp, User, ChevronsUpDown
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_ITEMS = [
  {
    group: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
      { icon: Building2, label: 'Universities', to: '/universities' },
      { icon: FlaskConical, label: 'Lab Management', to: '/labs' },
      { icon: CreditCard, label: 'Credit Management', to: '/credits' },
      { icon: Receipt, label: 'Transactions', to: '/transactions' },
      { icon: TrendingUp, label: 'Revenue & Analytics', to: '/revenue' },
      { icon: BarChart3, label: 'Reports', to: '/reports' },
    ],
  },
  {
    group: 'Account',
    items: [
      { icon: Settings, label: 'Settings', to: '/settings' },
      { icon: User, label: 'Profile', to: '/profile' },
    ],
  },
]

export function OwnerSidebar() {
  const { isMobile, state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate({ to: '/sign-in' })
  }

  const isActive = (to: string) => {
    if (to === '/') return currentPath === '/'
    return currentPath.startsWith(to)
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <div className="flex items-center justify-center gap-2 px-2 py-4">
          <img src="/images/logo.png" alt="ignitolearn" className="h-16 w-auto object-contain transition-all group-data-[collapsible=icon]:hidden" />
          <img src="/images/favicon.png" alt="icon" className="h-8 w-8 object-contain hidden group-data-[collapsible=icon]:block" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_ITEMS.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">{group.group}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold">
                      {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'OW'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{user?.fullName || 'Owner User'}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email || 'owner@ignito.com'}</span>
                  </div>
                  <ChevronsUpDown className="ms-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold">
                        {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'OW'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-start text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.fullName || 'Owner User'}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email || 'owner@ignito.com'}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
