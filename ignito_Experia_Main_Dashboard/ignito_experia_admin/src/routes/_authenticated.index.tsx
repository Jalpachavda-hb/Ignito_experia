import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Building2, DollarSign, Users, Cpu, TrendingUp, Sparkles, Activity, Layers, Server } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

const REVENUE_TREND_DATA = [
  { month: 'Jul', saas: 180000, credits: 100000 },
  { month: 'Aug', saas: 200000, credits: 110000 },
  { month: 'Sep', saas: 190000, credits: 105000 },
  { month: 'Oct', saas: 220000, credits: 120000 },
  { month: 'Nov', saas: 230000, credits: 130000 },
  { month: 'Dec', saas: 250000, credits: 140000 },
  { month: 'Jan', saas: 230000, credits: 125000 },
  { month: 'Feb', saas: 245000, credits: 135000 },
]

const DAILY_LAB_COMPUTE_DATA = [
  { time: '00:00', active: 220 },
  { time: '04:00', active: 110 },
  { time: '08:00', active: 650 },
  { time: '12:00', active: 940 },
  { time: '16:00', active: 780 },
  { time: '20:00', active: 430 },
  { time: '23:59', active: 290 },
]

const TOP_TENANTS_DATA = [
  { name: 'Pune Tech', full: 'Pune Tech University', labs: 1420, fill: '#f43f5e' },
  { name: 'Mumbai Inst.', full: 'Mumbai Digital Institute', labs: 1150, fill: '#8b5cf6' },
  { name: 'Bangalore CS', full: 'Bangalore CS Academy', labs: 980, fill: '#10b981' },
  { name: 'Chennai Engg', full: 'Chennai Engineering College', labs: 750, fill: '#0ea5e9' },
  { name: 'Delhi Innov.', full: 'Delhi Innovation College', labs: 520, fill: '#f59e0b' },
]

const TOP_ENVIRONMENTS_DATA = [
  { name: 'Ubuntu Base Container', count: 420, percent: '30%', color: '#10b981' },
  { name: 'Data Science & Python', count: 320, percent: '23%', color: '#8b5cf6' },
  { name: 'Full-Stack Web Dev', count: 280, percent: '20%', color: '#f43f5e' },
  { name: 'Cybersecurity & Kali', count: 210, percent: '15%', color: '#0ea5e9' },
  { name: 'Database Admin Workstation', count: 170, percent: '12%', color: '#f59e0b' },
]

function ExecutiveCard({
  title,
  value,
  badgeText,
  subtitle,
  icon: Icon,
  accentColor,
}: {
  title: string
  value: string
  badgeText?: string
  subtitle: string
  icon: React.ElementType
  accentColor: 'rose' | 'emerald' | 'violet' | 'sky'
}) {
  const colorMap = {
    rose: {
      bg: 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400',
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
    emerald: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
    violet: {
      bg: 'bg-violet-500/10 border-violet-500/20 text-violet-500 dark:text-violet-400',
      badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    },
    sky: {
      bg: 'bg-sky-500/10 border-sky-500/20 text-sky-500 dark:text-sky-400',
      badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    },
  }

  const active = colorMap[accentColor]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass bg-card/95 rounded-2xl p-5 border border-border/70 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between group"
    >
      <div className="space-y-1.5 min-w-0">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
          {title}
        </p>
        <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight truncate">
          {value}
        </h3>
        {badgeText && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1', active.badge)}>
              <TrendingUp className="h-3 w-3" />
              {badgeText}
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{subtitle}</span>
          </div>
        )}
      </div>

      <div className={cn('h-13 w-13 rounded-2xl flex items-center justify-center border shadow-2xs group-hover:scale-105 transition-transform flex-shrink-0 ml-3', active.bg)}>
        <Icon className="h-6 w-6" />
      </div>
    </motion.div>
  )
}

function CustomRevenueTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const saas = payload.find((p: any) => p.dataKey === 'saas')?.value || 0
    const credits = payload.find((p: any) => p.dataKey === 'credits')?.value || 0
    return (
      <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-xl text-xs space-y-2 min-w-[170px]">
        <p className="font-bold text-slate-900 dark:text-slate-100 border-b border-border/50 pb-1">{label}</p>
        <p className="text-rose-500 font-semibold flex items-center justify-between">
          <span>SaaS Subscriptions:</span>
          <span className="font-bold">{formatCurrency(saas)}</span>
        </p>
        <p className="text-violet-500 font-semibold flex items-center justify-between">
          <span>Credits Burn:</span>
          <span className="font-bold">{formatCurrency(credits)}</span>
        </p>
      </div>
    )
  }
  return null
}

function CustomTenantTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xl text-xs space-y-1">
        <p className="font-bold text-slate-900 dark:text-slate-100">{data.full}</p>
        <p className="text-primary font-semibold">{data.labs.toLocaleString()} active labs</p>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const [timeFilter, setTimeFilter] = useState<'6m' | '1y'>('6m')

  return (
    <>
      <Header>
        <Search />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="bg-[#fcfcfc] dark:bg-background min-h-[calc(100vh-3.5rem)]">
        <div className="space-y-6 max-w-[1600px] mx-auto py-6 px-4 sm:px-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Platform Executive Dashboard
                <Sparkles className="h-5 w-5 text-amber-500" />
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                High-level operational oversight, revenue growth, active compute workloads, and university tenant analytics.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-xl border border-border/60">
              <button
                onClick={() => setTimeFilter('6m')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                  timeFilter === '6m' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                6 Months
              </button>
              <button
                onClick={() => setTimeFilter('1y')}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                  timeFilter === '1y' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                This Year
              </button>
            </div>
          </div>

          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <ExecutiveCard
              title="Onboarded Universities"
              value="42"
              badgeText="+12.4%"
              subtitle="YoY Expansion"
              icon={Building2}
              accentColor="rose"
            />
            <ExecutiveCard
              title="Monthly Recurring Revenue"
              value={formatCurrency(2710000)}
              badgeText="+15.8%"
              subtitle="Overall Growth"
              icon={DollarSign}
              accentColor="emerald"
            />
            <ExecutiveCard
              title="Active Platform Students"
              value="12,450"
              badgeText="+8.2%"
              subtitle="Active Engagement"
              icon={Users}
              accentColor="violet"
            />
            <ExecutiveCard
              title="Active Concurrent Labs"
              value="1,204"
              badgeText="84 Templates"
              subtitle="Running Compute"
              icon={Cpu}
              accentColor="sky"
            />
          </div>

          {/* Row 2: Revenue Bar Chart (2/3) + Top Tenants Horizontal Bar Chart (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CARD 1: Monthly Platform Revenue Trend (Column Bar Chart) */}
            <div className="lg:col-span-2 glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Monthly Revenue Growth Breakdown
                    <Activity className="h-4 w-4 text-rose-500" />
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    SaaS Subscription revenue vs Credit Consumption burn across quarters.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> SaaS Subscription
                  </span>
                  <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Credits Burn
                  </span>
                </div>
              </div>

              <div className="h-[290px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={REVENUE_TREND_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 255)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.55 0.03 250)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.55 0.03 250)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomRevenueTooltip />} cursor={{ fill: 'oklch(0.96 0.01 250 / 0.4)' }} />
                    <Bar dataKey="saas" name="SaaS Subscription" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="credits" name="Credits Burn" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CARD 2: Top Tenant Universities (Horizontal Bar Chart) */}
            <div className="glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Top Tenant Universities
                  <Building2 className="h-4 w-4 text-violet-500" />
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Ranking by active lab container usage.</p>
              </div>

              <div className="h-[290px] w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TOP_TENANTS_DATA} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.92 0.01 255)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: 'oklch(0.55 0.03 250)' }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.45 0.03 250)' }} width={90} />
                    <Tooltip content={<CustomTenantTooltip />} cursor={{ fill: 'oklch(0.96 0.01 250 / 0.4)' }} />
                    <Bar dataKey="labs" radius={[0, 6, 6, 0]}>
                      {TOP_TENANTS_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Row 3: Container Compute Load Area (2/3) + Top Environments Donut Chart (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* CARD 3: Daily Container Compute Load (Smooth Gradient Area Chart) */}
            <div className="lg:col-span-2 glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Daily Container Compute Load
                    <Server className="h-4 w-4 text-sky-500" />
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time active lab container instances running across Docker hosts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                    Peak: 940 active
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Cap: 1,000 max
                  </span>
                </div>
              </div>

              <div className="h-[260px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={DAILY_LAB_COMPUTE_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 255)" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.55 0.03 250)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.55 0.03 250)' }} domain={[0, 1000]} ticks={[0, 250, 500, 750, 1000]} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.08)', fontWeight: 600 }}
                      formatter={(val: number) => [`${val} active labs`, 'Running Compute']}
                    />
                    <Area
                      type="monotone"
                      dataKey="active"
                      stroke="#0ea5e9"
                      strokeWidth={3}
                      fill="url(#compGrad)"
                      dot={false}
                      activeDot={{ fill: '#0ea5e9', r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CARD 4: Top Virtual Environments (Interactive Donut Chart with Breakdown) */}
            <div className="glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Top Virtual Environments
                  <Layers className="h-4 w-4 text-emerald-500" />
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Most launched lab templates by students.</p>
              </div>

              {/* Donut Chart & Legend Breakdown */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-[180px] w-[140px] flex-shrink-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={TOP_ENVIRONMENTS_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="count"
                      >
                        {TOP_ENVIRONMENTS_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}
                        formatter={(val: number) => [`${val} sessions`, 'Launched']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-tight">1.4K</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Sessions</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 min-w-0">
                  {TOP_ENVIRONMENTS_DATA.map((env) => (
                    <div key={env.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: env.color }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{env.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 flex-shrink-0 ml-1">{env.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </Main>
    </>
  )
}
