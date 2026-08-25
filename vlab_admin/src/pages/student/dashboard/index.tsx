import React, { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { dashboardData } from './data'
import { useAuthStore } from '@/stores/auth-store'
import { useLabStore } from '@/stores/labStore'
import { useLabSessionStore } from '@/stores/labSessionStore'
import { PasswordSetupModal } from '@/components/auth/PasswordSetupModal'
import { useNavigate } from '@tanstack/react-router'

// UI Components for Header Navbar
import { Bell, User, Settings, HelpCircle, LogOut, KeyRound } from 'lucide-react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// Dashboard Components
import { WelcomeBanner } from './components/welcome-banner'
import { StatsCards } from './components/stats-cards'
import { LabActivity } from './components/lab-activity'
import { CreditWalletSummary } from './components/credit-wallet-summary'

import { getSavedLabActivities, saveLabActivity } from '@/Utils/labActivityTracker'

import { BASE_URL } from '@/Utils/Api_path'

const getProfileImgUrl = (imgUrl: string | null | undefined) => {
  if (!imgUrl) return null;
  if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
    return imgUrl;
  }
  const backendOrigin = BASE_URL.replace(/\/api\/?$/, '');
  return `${backendOrigin}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
};

import { useTransactionStore } from '@/stores/transactionStore'
import { useLabTokenStore } from '@/stores/labTokenStore'

// Activity & Breakdown Chart Components
import { MonthlyActivityChart } from '../transactions/components/monthly-activity-chart'
import { TransactionBreakdownChart } from '../transactions/components/transaction-breakdown-chart'

export default function StudentDashboard() {
  const data = dashboardData
  const { auth } = useAuthStore()
  const { user } = auth
  const { labs, loadLabs } = useLabStore()
  const { activeSession, loadActiveSession } = useLabSessionStore()
  const { labWallets, fetchStudentLabTokens } = useLabTokenStore()
  const { fetchTransactions } = useTransactionStore()
  const navigate = useNavigate()
  const [showPasswordSetup, setShowPasswordSetup] = useState(false)

  const studentName = auth.user?.fullName || auth.user?.name || data.student.name
  const studentEmail = auth.user?.email || data.student.email
  const initials = studentName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'ST'

  const unreadNotifications = data.notifications.filter(n => !n.isRead).length

  useEffect(() => {
    loadLabs()
    fetchStudentLabTokens()
    fetchTransactions()
  }, [loadLabs, fetchStudentLabTokens, fetchTransactions])

  useEffect(() => {
    if (!user?.userId && !user?.email) return
    const userId = String(user.userId ?? user.email)
    loadActiveSession(userId)
  }, [user, loadActiveSession])

  const dynamicRecentLabs = useMemo(() => {
    const result: any[] = []

    // 1. If student currently has an active running session, place it at top as "In Progress"
    if (activeSession) {
      const activeLabId = activeSession.labId
      const cleanId = String(activeLabId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
      const matchedLab = labs.find(l => {
        const id = String(l.id || l.labId || l.LabId || l.labCode || l._id || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
        return id === cleanId;
      })

      result.push({
        id: activeLabId || 'session-active',
        labName: matchedLab?.title || matchedLab?.name || (cleanId.includes('python') ? 'Python Programming Lab' : cleanId.includes('java') ? 'Java Development Lab' : activeLabId),
        status: 'In Progress' as const,
        creditsUsed: matchedLab?.credits || 1,
        completionPercentage: 50,
        lastAccessed: activeSession.startedAt || new Date().toISOString()
      })
    }

    // 2. Add all completed / stopped lab practices with exact real consumed tokens from labWallets
    (labWallets || []).forEach(w => {
      const used = Number(w.usedTokens || 0);
      const remaining = Number(w.remainingTokens || 0);
      if (used > 0) {
        const cleanId = String(w.labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
        let labName = 'Virtual Lab';
        if (cleanId.includes('python')) labName = 'Python Programming Lab';
        else if (cleanId.includes('java')) labName = 'Java Development Lab';
        else if (cleanId.includes('linux')) labName = 'Linux Administration Lab';
        else if (cleanId.includes('android')) labName = 'Android Application Lab';
        else if (cleanId.includes('dotnet')) labName = '.NET Technologies Lab';
        else labName = `${w.labId.toUpperCase()} Lab`;

        const status = remaining > 0 ? ('Stopped' as const) : ('Completed' as const);

        if (!result.some(r => String(r.id).toLowerCase().includes(cleanId))) {
          result.push({
            id: `recent-${cleanId}`,
            labName,
            status,
            creditsUsed: used,
            completionPercentage: remaining > 0 ? Math.round((used / (used + remaining)) * 100) : 100,
            lastAccessed: w.updatedAt || new Date().toISOString()
          });
        }
      }
    });

    return result
  }, [labs, activeSession, labWallets])

  useEffect(() => {
    // Prompt first-time LMS students to set an optional Experia Password (if not skipped in session)
    const isSkipped = typeof window !== 'undefined' && sessionStorage.getItem('skipPasswordSetup') === 'true'
    if (auth.user && auth.user.hasPassword === false && !isSkipped) {
      setShowPasswordSetup(true)
    }
  }, [auth.user])

  const handleClosePasswordModal = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('skipPasswordSetup', 'true')
    }
    setShowPasswordSetup(false)
  }

  const handleLogout = () => {
    auth.reset()
    navigate({ to: '/sign-in' })
  }

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

        {/* Top Navbar Profile Area (Aligned to far right) */}
        <div className="flex items-center gap-4 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 flex items-center justify-start gap-2 rounded-full p-1 pr-4 hover:bg-muted/50 border border-transparent transition-colors">
                <div className="h-8 w-8 rounded-full overflow-hidden relative flex items-center justify-center bg-red-100 text-red-600 shrink-0">
                  {getProfileImgUrl(user?.profileImage) ? (
                    <img
                      src={getProfileImgUrl(user?.profileImage)!}
                      alt={studentName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.display = 'none';
                        if (target.nextElementSibling) {
                          (target.nextElementSibling as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full font-bold text-[11px] bg-red-100 text-red-600 flex items-center justify-center"
                    style={{ display: getProfileImgUrl(user?.profileImage) ? 'none' : 'flex' }}
                  >
                    {initials}
                  </div>
                </div>
                <span className="font-semibold text-sm mr-1">{initials}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{studentName}</p>
                  <p className="text-[11px] leading-none text-muted-foreground">
                    {studentEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {auth.user?.hasPassword === false && (
                  <DropdownMenuItem onClick={() => setShowPasswordSetup(true)} className="text-amber-600 font-medium">
                    <KeyRound className="mr-2 h-4 w-4" />
                    <span>Set Direct Password</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate({ to: '/student/profile' })} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50">
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

          {/* Row 2: Top Statistics Cards */}
          <StatsCards />

          {/* Row 3: Real-Time Token Activity & Lab Usage Share Charts (Before Recent Lab Activity) */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-2">
            <div className="xl:col-span-2">
              <MonthlyActivityChart />
            </div>
            <div>
              <TransactionBreakdownChart mode="consumed" />
            </div>
          </div>

          {/* Row 4: Recent Lab Activity */}
          <div className="pt-4 border-t border-border/40">
            <h3 className="text-lg font-semibold text-muted-foreground mb-6">Additional Insights</h3>
            <div className="grid grid-cols-1 gap-6">
              <LabActivity labs={dynamicRecentLabs} />
            </div>
          </div>

          {/* Credit Wallet Summary */}
          <div className="grid grid-cols-1 gap-6">
            <div>
              <CreditWalletSummary />
            </div>
          </div>

        </div>
      </Main>

      {/* Password Setup Modal for LMS Students without a Password */}
      <PasswordSetupModal
        isOpen={showPasswordSetup}
        onClose={handleClosePasswordModal}
      />
    </>
  )
}
