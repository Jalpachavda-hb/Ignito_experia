import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Building2, Users, GraduationCap, BookOpen, FlaskConical,
  TrendingUp, DollarSign, Activity,
} from 'lucide-react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

const STATS = [
  { label: 'Total Universities', value: 24, icon: Building2, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', trend: '+3 this month' },
  { label: 'Active Universities', value: 21, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', trend: '87.5% active' },
  { label: 'Total Students', value: 18420, icon: GraduationCap, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20', trend: '+1,240 this month' },
  { label: 'Total Faculty', value: 1284, icon: Users, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', trend: '+45 this month' },
  { label: 'Total Labs', value: 68, icon: FlaskConical, color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/20', trend: '8 new labs' },
  { label: 'Total Courses', value: 342, icon: BookOpen, color: 'text-indigo-500', bg: 'bg-indigo-500/10 border-indigo-500/20', trend: '+22 this month' },
  { label: 'Total Revenue', value: 4280000, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', trend: '+18% YoY', isCurrency: true },
  { label: 'Monthly Revenue', value: 380000, icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', trend: '+12% vs last month', isCurrency: true },
]

const MONTHLY_REVENUE = [
  { month: 'Jul', revenue: 280000, credits: 120000 },
  { month: 'Aug', revenue: 310000, credits: 145000 },
  { month: 'Sep', revenue: 295000, credits: 135000 },
  { month: 'Oct', revenue: 340000, credits: 160000 },
  { month: 'Nov', revenue: 360000, credits: 175000 },
  { month: 'Dec', revenue: 390000, credits: 190000 },
  { month: 'Jan', revenue: 355000, credits: 168000 },
  { month: 'Feb', revenue: 380000, credits: 182000 },
]

const UNIVERSITY_GROWTH = [
  { month: 'Jul', universities: 16 },
  { month: 'Aug', universities: 17 },
  { month: 'Sep', universities: 18 },
  { month: 'Oct', universities: 19 },
  { month: 'Nov', universities: 20 },
  { month: 'Dec', universities: 21 },
  { month: 'Jan', universities: 23 },
  { month: 'Feb', universities: 24 },
]

const TOP_UNIVERSITIES = [
  { name: 'Pune Tech Univ.', usage: 98, revenue: 420000 },
  { name: 'Mumbai Digital', usage: 91, revenue: 380000 },
  { name: 'Bangalore CS', usage: 88, revenue: 350000 },
  { name: 'Delhi Innovation', usage: 84, revenue: 310000 },
  { name: 'Chennai Tech', usage: 79, revenue: 280000 },
]

const REVENUE_PIE = [
  { name: 'Subscriptions', value: 60, color: '#be2126' }, // Primary Red
  { name: 'Credit Sales', value: 32, color: 'oklch(0.6 0.16 280)' }, // Soft Violet
  { name: 'Other', value: 8, color: 'oklch(0.8 0.05 250)' }, // Cool Grey
]

const RECENT_ACTIVITY = [
  { type: 'university', message: 'Pune Tech University joined the platform', time: '2 hours ago', icon: Building2, color: 'text-violet-500' },
  { type: 'lab', message: 'New lab "Kubernetes Lab" added to catalog', time: '4 hours ago', icon: FlaskConical, color: 'text-pink-500' },
  { type: 'revenue', message: 'Monthly credit purchase: Mumbai Digital — ₹45,000', time: '6 hours ago', icon: DollarSign, color: 'text-emerald-500' },
  { type: 'university', message: 'Bangalore CS University activated 120 new students', time: '8 hours ago', icon: GraduationCap, color: 'text-sky-500' },
  { type: 'lab', message: '"Python Data Science Lab" status changed to active', time: '12 hours ago', icon: Activity, color: 'text-emerald-500' },
]

function StatCard({ stat, index }: { stat: typeof STATS[0]; index: number }) {
  const Icon = stat.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={cn('glass rounded-2xl p-5 border border-border/60 hover:shadow-md hover:border-primary/20 transition-all')}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center border', stat.bg)}>
          <Icon className={cn('h-4.5 w-4.5', stat.color)} />
        </div>
        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full font-medium">
          {stat.trend}
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground">
        {stat.isCurrency ? formatCurrency(stat.value) : formatNumber(stat.value)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5 font-medium">{stat.label}</p>
    </motion.div>
  )
}

const themeColors = {
  primary: '#be2126', // Ignito Primary Red
  secondary: 'oklch(0.6 0.16 280)', // Soft Violet
  accent: 'oklch(0.65 0.15 220)', // Steel Blue
  gridLine: 'oklch(0.929 0.013 255.508)', // Faint border line matching layout
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/50">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default function DashboardPage() {
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
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Platform-wide statistics and usage summary.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <StatCard key={stat.label} stat={stat} index={i} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ChartCard title="Monthly Revenue & Credit Sales">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={MONTHLY_REVENUE} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                    <defs>
                      <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={themeColors.primary} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={themeColors.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="secondaryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={themeColors.secondary} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={themeColors.secondary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={themeColors.gridLine} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                      itemStyle={{ fontSize: 12 }}
                      formatter={(v: number) => [formatCurrency(v)]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke={themeColors.primary} fill="url(#primaryGrad)" strokeWidth={2.5} name="SaaS Subscription" />
                    <Area type="monotone" dataKey="credits" stroke={themeColors.secondary} fill="url(#secondaryGrad)" strokeWidth={2.5} name="Credit Purchases" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Revenue Breakdown">
              <div className="relative flex flex-col justify-center items-center h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={REVENUE_PIE} cx="50%" cy="50%" innerRadius={58} outerRadius={80} paddingAngle={4} dataKey="value">
                      {REVENUE_PIE.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      formatter={(v: number) => [`${v}%`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">₹3.8L</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">This Month</span>
                </div>
              </div>
              <div className="space-y-2 mt-4 border-t border-border/40 pt-3">
                {REVENUE_PIE.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-muted-foreground font-medium">{item.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="University Onboarding Curve">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={UNIVERSITY_GROWTH} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={themeColors.gridLine} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="universities"
                    stroke={themeColors.accent}
                    strokeWidth={3}
                    dot={{ fill: themeColors.accent, strokeWidth: 1.5, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Universities"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top Universities by Usage">
              <div className="space-y-3.5 pt-1">
                {TOP_UNIVERSITIES.map((uni, i) => (
                  <div key={uni.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-4.5 h-4.5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] text-primary font-bold">{i + 1}</span>
                        <span className="text-foreground font-semibold">{uni.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                        <span className="font-medium">{uni.usage}% Usage</span>
                        <span className="text-primary font-bold">{formatCurrency(uni.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uni.usage}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-primary via-rose-500 to-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          <div className="glass rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <FlaskConical className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Recent Activity Logs</h3>
            </div>
            <div className="space-y-3">
              {RECENT_ACTIVITY.map((activity, i) => {
                const Icon = activity.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/60 transition-colors"
                  >
                    <div className="h-7 w-7 rounded-lg bg-background flex items-center justify-center flex-shrink-0 border border-border/40">
                      <Icon className={cn('h-3.5 w-3.5', activity.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground font-medium">{activity.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{activity.time}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}
