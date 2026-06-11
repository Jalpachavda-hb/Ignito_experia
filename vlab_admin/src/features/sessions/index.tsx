import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, StopCircle, XCircle, Timer } from 'lucide-react'
import { SessionsTable } from './components/sessions-table'
import { mockSessions, timelineData } from './data/mock-data'
import { SessionsProvider, useSessions } from './context/sessions-context'
import { SessionActionDialogs } from './components/sessions-action-dialogs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'

function SessionsViewContent() {
  const { dialogOpen, setDialogOpen, currentRow } = useSessions()

  const runningCount = mockSessions.filter(s => s.status === 'running').length
  const stoppedCount = mockSessions.filter(s => s.status === 'stopped').length
  const failedCount = mockSessions.filter(s => s.status === 'failed').length

  // Calculate Avg Duration of stopped sessions
  const stoppedSessions = mockSessions.filter(s => s.status === 'stopped' && s.endTime)
  const avgMins = stoppedSessions.length > 0
    ? Math.floor(stoppedSessions.reduce((acc, s) => acc + ((s.endTime!.getTime() - s.startTime.getTime()) / 60000), 0) / stoppedSessions.length)
    : 0

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main>
        <div className='mb-6 flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Session Monitoring</h1>
            <p className='text-muted-foreground mt-1'>
              Real-time infrastructure telemetry and container session tracking.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Running Sessions</CardTitle>
              <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{runningCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active containers
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stopped Sessions</CardTitle>
              <StopCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stoppedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Gracefully terminated
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Sessions</CardTitle>
              <XCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{failedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                OOM or crash exits
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
              <Timer className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.floor(avgMins / 60)}h {avgMins % 60}m</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across historic sessions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Chart */}
        <Card className="border-border/50 shadow-sm mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Session Launch Timeline (Today)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pt-4">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="hour" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="launches" name="New Sessions" radius={[2, 2, 0, 0]} maxBarSize={40}>
                    {timelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="hsl(var(--primary))" className="opacity-80 hover:opacity-100" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <SessionsTable data={mockSessions} />

      </Main>

      <SessionActionDialogs 
        type={dialogOpen}
        session={currentRow}
        open={dialogOpen !== null}
        onOpenChange={(v) => !v && setDialogOpen(null)}
      />
    </>
  )
}

export default function SessionsView() {
  return (
    <SessionsProvider>
      <SessionsViewContent />
    </SessionsProvider>
  )
}
