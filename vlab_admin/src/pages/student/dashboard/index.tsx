import React from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { dashboardData } from './data'

// UI Components for Header Navbar
import { Bell, User, Settings, HelpCircle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

// Dashboard Components
import { WelcomeBanner } from './components/welcome-banner'
import { StatsCards } from './components/stats-cards'
import { AcademicProgress } from './components/academic-progress'
import { CurrentCourses } from './components/current-courses'
import { RecentActivityTimeline } from './components/recent-activity-timeline'

// Preserved Components requested by user
import { PerformanceCharts } from './components/performance-charts'
import { LabActivity } from './components/lab-activity'

import { CreditWalletSummary } from './components/credit-wallet-summary'

export default function StudentDashboard() {
  const data = dashboardData

  const initials = data.student.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)

  const unreadNotifications = data.notifications.filter(n => !n.isRead).length

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Student Portal</span>
            <span className="text-border">/</span>
            <span className="text-red-500 font-semibold">Dashboard</span>
          </div>
        </div>

        {/* Top Navbar Profile Area */}
        <div className="flex items-center gap-4">

          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-2 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadNotifications}
              </span>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 flex items-center justify-start gap-2 rounded-full p-1 pr-4 hover:bg-muted/50 border border-transparent transition-colors">
                <Avatar className="h-8 w-8 bg-red-100 text-red-600">
                  <AvatarFallback className="font-bold text-[11px]">{initials}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm mr-1">RS</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{data.student.name}</p>
                  <p className="text-[11px] leading-none text-muted-foreground">
                    {data.student.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </Header>

      <Main className="bg-[#f8fafc] dark:bg-background min-h-[calc(100vh-4rem)]">
        <div className="w-full px-4 md:px-6 xl:px-10 py-6 space-y-6 max-w-[1600px] mx-auto">

          {/* Row 1: Welcome Banner */}
          <WelcomeBanner student={data.student} wallet={data.wallet} />

          {/* Row 2: Top Statistics Cards (exactly 4) */}
          <StatsCards data={data} />
          <div className="pt-8 mt-8 border-t border-border/40">
            <h3 className="text-lg font-semibold text-muted-foreground mb-6">Additional Insights</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceCharts weeklyActivity={data.weeklyActivity} />
              <LabActivity labs={data.recentLabs} />
            </div>
          </div>
          {/* Row 3: Academic Overview, Current Courses, Credit Wallet */}
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
            <div className="lg:col-span-3">
              <AcademicProgress program={data.student.program} stats={data.academicOverviewStats} />
            </div>

            <div className="lg:col-span-3">
              <CreditWalletSummary wallet={data.wallet} transactions={data.transactions} />
            </div>
          </div>

          <CurrentCourses courses={data.currentCourses} />

          {/* Row 4: Recent Activity Timeline */}



          {/* ========================================================================= */}
          {/* Preserved Components */}
          {/* ========================================================================= */}



        </div>
      </Main>
    </>
  )
}
