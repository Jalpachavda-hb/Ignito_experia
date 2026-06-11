import React from 'react'
import {
  Users,
  UserCheck,
  ShieldAlert,
  Server,
  Activity,
  Box,
  CreditCard,
  TrendingDown,
  Search as SearchIcon,
  Bell,
  RefreshCw,
  MoreVertical,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  PlusCircle,
  Database,
  UploadCloud,
  CheckCircle2,
  PlayCircle,
  StopCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

// --- Mock Data ---
const labLaunchData = [
  { time: '00:00', launches: 12 },
  { time: '04:00', launches: 5 },
  { time: '08:00', launches: 45 },
  { time: '12:00', launches: 98 },
  { time: '16:00', launches: 85 },
  { time: '20:00', launches: 30 },
  { time: '23:59', launches: 15 },
]

const creditConsumptionData = [
  { day: 'Mon', credits: 4000 },
  { day: 'Tue', credits: 3000 },
  { day: 'Wed', credits: 5000 },
  { day: 'Thu', credits: 2780 },
  { day: 'Fri', credits: 6890 },
  { day: 'Sat', credits: 2390 },
  { day: 'Sun', credits: 3490 },
]

const mostUsedLabsData = [
  { name: 'Ubuntu Base', sessions: 400 },
  { name: 'Data Science', sessions: 300 },
  { name: 'Web Dev', sessions: 278 },
  { name: 'Cybersec', sessions: 200 },
  { name: 'DB Admin', sessions: 189 },
]

const activeUsersData = [
  { time: 'Mon', users: 1200 },
  { time: 'Tue', users: 1400 },
  { time: 'Wed', users: 1100 },
  { time: 'Thu', users: 1600 },
  { time: 'Fri', users: 1800 },
  { time: 'Sat', users: 900 },
  { time: 'Sun', users: 850 },
]

export function Dashboard() {
  return (
    <>
      {/* ===== Global Header ===== */}
      <Header className="justify-between bg-background border-b border-border/40 px-6 h-14">
        <div className="flex items-center gap-4">
          <div className="flex aspect-square size-7 items-center justify-center rounded bg-primary/10 text-primary md:hidden">
            <Server className="size-4" />
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Enterprise Admin</span>
            <span className="text-border">/</span>
            <span className="text-foreground">Global Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 hidden lg:block group">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="search"
              placeholder="Search resources, users..."
              className="w-full bg-muted/40 pl-8 rounded border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 hidden sm:flex gap-2 text-xs border-border/50">
              <CalendarDays className="h-3.5 w-3.5" />
              Last 7 Days
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </Button>
            <Avatar className="h-7 w-7 rounded border border-border/50 ml-1 cursor-pointer">
              <AvatarImage src="/avatars/shadcn.jpg" alt="Admin" />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] rounded">AD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </Header>

      {/* ===== Main Dashboard Workspace ===== */}
      <Main className="bg-[#fcfcfc] dark:bg-background min-h-[calc(100vh-3.5rem)]">
        <div className="space-y-6 max-w-[1600px] mx-auto py-6">
          
          {/* Header Area & Quick Actions */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Infrastructure Overview</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900/50 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  System Healthy
                </Badge>
                <p className="text-sm text-muted-foreground">Real-time metrics for compute, identities, and billing.</p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 bg-card border border-border/50 p-1.5 rounded-lg shadow-sm">
              <Button variant="ghost" size="sm" className="h-8 text-xs font-medium bg-primary/5 hover:bg-primary/10 text-primary">
                <UserPlus className="h-3.5 w-3.5 mr-2" />
                Add User
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-medium hover:bg-muted">
                <PlusCircle className="h-3.5 w-3.5 mr-2" />
                Create Lab
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-medium hover:bg-muted">
                <Database className="h-3.5 w-3.5 mr-2" />
                Allocate Credits
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-medium hover:bg-muted">
                <UploadCloud className="h-3.5 w-3.5 mr-2" />
                Import Students
              </Button>
            </div>
          </div>

          {/* 8 High-Density Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <MetricCard title="Total Students" value="12,450" icon={<Users className="h-4 w-4 text-blue-500" />} trend="+4.2%" isPositive={true} />
            <MetricCard title="Total Faculty" value="340" icon={<UserCheck className="h-4 w-4 text-indigo-500" />} trend="+1.1%" isPositive={true} />
            <MetricCard title="Total Admins" value="12" icon={<ShieldAlert className="h-4 w-4 text-rose-500" />} trend="0%" isPositive={true} />
            <MetricCard title="Total Labs" value="84" icon={<Server className="h-4 w-4 text-slate-500" />} trend="+5" isPositive={true} />            
            <MetricCard title="Active Sessions" value="1,204" icon={<Activity className="h-4 w-4 text-emerald-500" />} trend="+15%" isPositive={true} highlight={true} />        
            
            <MetricCard title="Credit Pool" value="4.2M" icon={<CreditCard className="h-4 w-4 text-amber-500" />} trend="-1.2%" isPositive={false} />
            <MetricCard title="Consumed Today" value="45,200" icon={<TrendingDown className="h-4 w-4 text-orange-500" />} trend="+8.4%" isPositive={false} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            
            {/* Daily Lab Launch Trend */}
            <Card className="xl:col-span-2 shadow-sm border-border/50 rounded-lg flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">Daily Lab Launch Trend</CardTitle>
                  <p className="text-xs text-muted-foreground">Aggregated lab launch metrics across all regions.</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="h-[250px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={labLaunchData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorLaunch" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', backgroundColor: 'var(--background)' }}
                        itemStyle={{ color: 'var(--foreground)' }}
                      />
                      <Area type="monotone" dataKey="launches" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorLaunch)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity Feed */}
            <Card className="xl:col-span-1 shadow-sm border-border/50 rounded-lg flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                  <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">Live</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="space-y-4 pr-2 mt-2">
                  <ActivityItem 
                    icon={<UserPlus className="h-4 w-4 text-blue-500" />}
                    title="User Created"
                    description="Admin created student account jane.doe@edu"
                    time="2 mins ago"
                  />
                  <ActivityItem 
                    icon={<Database className="h-4 w-4 text-amber-500" />}
                    title="Credits Allocated"
                    description="5,000 credits allocated to Web Dev Course"
                    time="15 mins ago"
                  />
                  <ActivityItem 
                    icon={<PlayCircle className="h-4 w-4 text-emerald-500" />}
                    title="Lab Started"
                    description="Ubuntu Base instance started by user_482"
                    time="28 mins ago"
                  />
                  <ActivityItem 
                    icon={<StopCircle className="h-4 w-4 text-rose-500" />}
                    title="Lab Terminated"
                    description="Data Science session auto-terminated (Idle)"
                    time="1 hour ago"
                  />
                  <ActivityItem 
                    icon={<CheckCircle2 className="h-4 w-4 text-indigo-500" />}
                    title="User Created"
                    description="Bulk import of 120 students completed"
                    time="3 hours ago"
                  />
                  <ActivityItem 
                    icon={<PlayCircle className="h-4 w-4 text-emerald-500" />}
                    title="Lab Started"
                    description="Cybersec instance started by instructor_01"
                    time="4 hours ago"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Credit Consumption Trend */}
            <Card className="shadow-sm border-border/50 rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">Credit Consumption Trend</CardTitle>
                  <p className="text-xs text-muted-foreground">Platform credits burned over the last 7 days.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={creditConsumptionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', backgroundColor: 'var(--background)' }}
                      />
                      <Line type="monotone" dataKey="credits" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 2, stroke: 'var(--background)' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Active Users Trend */}
            <Card className="shadow-sm border-border/50 rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">Active Users Trend</CardTitle>
                  <p className="text-xs text-muted-foreground">Unique active identities connecting per day.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeUsersData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', backgroundColor: 'var(--background)' }}
                      />
                      <Area type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Most Used Labs */}
            <Card className="shadow-sm border-border/50 rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">Most Used Labs</CardTitle>
                  <p className="text-xs text-muted-foreground">Top environments by instantiation.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mostUsedLabsData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--foreground)' }} width={90} />
                      <Tooltip 
                        cursor={{ fill: 'var(--muted)' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', backgroundColor: 'var(--background)' }}
                      />
                      <Bar dataKey="sessions" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </Main>
    </>
  )
}

// --- UI Components ---

function MetricCard({ title, value, icon, trend, isPositive, highlight }: any) {
  return (
    <Card className={`rounded-lg border-border/50 shadow-sm ${highlight ? 'bg-primary/[0.03] border-primary/20' : 'bg-card'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground truncate">{title}</p>
          <div className="p-1.5 rounded-md bg-muted/50 border border-border/50">
            {icon}
          </div>
        </div>
        <div className="flex items-baseline justify-between mt-3">
          <h3 className="text-xl font-bold tracking-tight">{value}</h3>
          <div className={`flex items-center text-[10px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPositive ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
            {trend}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityItem({ icon, title, description, time }: any) {
  return (
    <div className="flex items-start gap-3 py-1 group">
      <div className="mt-0.5 h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{title}</p>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{time}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-tight">{description}</p>
      </div>
    </div>
  )
}
