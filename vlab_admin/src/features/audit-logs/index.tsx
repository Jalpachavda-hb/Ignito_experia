import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AuditLogsTable } from './components/audit-logs-table'
import { AuditLogsFilters } from './components/audit-logs-filters'
import { AuditLogsSheet } from './components/audit-logs-sheet'
import { mockAuditLogs } from './data/mock-data'
import { AuditLogsProvider } from './context/audit-logs-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, ShieldAlert, KeyRound } from 'lucide-react'

function AuditLogsViewContent() {
  const failedLogins = mockAuditLogs.filter(log => log.action === 'LOGIN_FAILED').length
  const destructiveActions = mockAuditLogs.filter(log => log.action === 'DELETE').length

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main className="bg-background">
        <div className='mb-6 flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Security & Audit Logs</h1>
            <p className='text-muted-foreground mt-1 font-mono text-sm'>
              Immutable ledger of administrative actions and security events.
            </p>
          </div>
        </div>

        {/* Security Metrics */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events (30d)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{mockAuditLogs.length}</div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Authentications</CardTitle>
              <KeyRound className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono">{failedLogins}</div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Destructive Actions</CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">{destructiveActions}</div>
            </CardContent>
          </Card>
        </div>

        <AuditLogsFilters />

        <div className='flex-1 m-0 flex flex-col min-h-0 overflow-hidden'>
          <AuditLogsTable data={mockAuditLogs} />
        </div>
      </Main>

      <AuditLogsSheet />
    </>
  )
}

export default function AuditLogsView() {
  return (
    <AuditLogsProvider>
      <AuditLogsViewContent />
    </AuditLogsProvider>
  )
}
