import { useRouterState } from '@tanstack/react-router'
import { Bell, Calendar, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Header } from './header'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Global Dashboard',
  '/universities': 'University Management',
  '/labs': 'Lab Catalog',
  '/credits': 'Credit Pools',
  '/transactions': 'Transactions & Billing',
  '/revenue': 'Revenue Analytics',
  '/reports': 'System Reports',
  '/settings': 'Platform Settings',
  '/profile': 'Profile Details',
}

function getPageTitle(pathname: string): string {
  const exact = PAGE_TITLES[pathname]
  if (exact) return exact
  const prefix = Object.keys(PAGE_TITLES).find(
    (k) => k !== '/' && pathname.startsWith(k)
  )
  return prefix ? PAGE_TITLES[prefix] : 'Global Dashboard'
}

export function OwnerHeader() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const title = getPageTitle(currentPath)
  const { user } = useAuthStore()

  return (
    <Header className="justify-between bg-white border-b border-slate-200/60 px-4 h-14 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 rounded-md font-semibold tracking-wide uppercase">
          Platform Owner
        </span>
        <span className="text-xs text-slate-300 font-semibold">/</span>
        <span className="text-xs font-semibold text-slate-800">{title}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-muted-foreground w-64 shadow-inner">
          <Search className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Search resources, universities...</span>
        </div>

        <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <span>Last 7 Days</span>
        </button>

        <button className="relative h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors bg-white shadow-sm">
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
        </button>

        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs shadow-sm">
            {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'OW'}
          </div>
          <div className="hidden sm:block text-start leading-none">
            <p className="text-xs font-bold text-slate-800">{user?.fullName || 'Owner'}</p>
            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{user?.role || 'owner'}</p>
          </div>
        </div>
      </div>
    </Header>
  )
}
