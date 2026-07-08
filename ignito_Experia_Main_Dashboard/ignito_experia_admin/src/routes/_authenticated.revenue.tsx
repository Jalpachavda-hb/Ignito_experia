import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { DollarSign, Landmark, TrendingUp, CreditCard, Sparkles } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/revenue')({
  component: RevenuePage,
})

const REVENUE_ANALYTICS = [
  { month: 'Jul', subscription: 180000, creditSales: 100000, total: 280000 },
  { month: 'Aug', subscription: 200000, creditSales: 110000, total: 310000 },
  { month: 'Sep', subscription: 190000, creditSales: 105000, total: 295000 },
  { month: 'Oct', subscription: 220000, creditSales: 120000, total: 340000 },
  { month: 'Nov', subscription: 240000, creditSales: 120000, total: 360000 },
  { month: 'Dec', subscription: 260000, creditSales: 130000, total: 390000 },
  { month: 'Jan', subscription: 230000, creditSales: 125000, total: 355000 },
  { month: 'Feb', subscription: 250000, creditSales: 130000, total: 380000 },
]

const SYSTEM_STATS = [
  { label: 'YTD SaaS Subscriptions', value: 1770000, icon: Landmark, color: 'text-rose-500', bg: 'bg-rose-500/10 border border-rose-500/20' },
  { label: 'YTD Credits Revenue', value: 940000, icon: CreditCard, color: 'text-violet-500', bg: 'bg-violet-500/10 border border-violet-500/20' },
  { label: 'Total Revenue Generated', value: 2710000, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border border-emerald-500/20' },
  { label: 'Average Contract Value', value: 185000, icon: TrendingUp, color: 'text-sky-500', bg: 'bg-sky-500/10 border border-sky-500/20' },
]

const colors = {
  subscription: '#be2126', // Ignito Red
  creditSales: 'oklch(0.6 0.16 280)', // Soft Violet
  gridLine: 'oklch(0.929 0.013 255.508)', // Faint grey line
}

export default function RevenuePage() {
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Revenue & Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Detailed platform monetization analytics, MRR tracker, and category-wise performance reports.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SYSTEM_STATS.map((stat, i) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="glass rounded-2xl p-5 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.bg)}>
                      <Icon className={cn('h-4.5 w-4.5', stat.color)} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-2">{formatCurrency(stat.value)}</p>
                </motion.div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass rounded-2xl p-5 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">YTD Monetization Channels</h3>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-semibold text-primary">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Live
                </span>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={REVENUE_ANALYTICS} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                  <defs>
                    <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.subscription} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={colors.subscription} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.creditSales} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={colors.creditSales} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.gridLine} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                    formatter={(v: number) => [formatCurrency(v)]}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="subscription" stroke={colors.subscription} fill="url(#subGrad)" strokeWidth={2.5} name="Subscriptions" />
                  <Area type="monotone" dataKey="creditSales" stroke={colors.creditSales} fill="url(#credGrad)" strokeWidth={2.5} name="Credit Sales" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-2xl p-5 border border-border space-y-4">
              <h3 className="text-sm font-semibold text-foreground">MRR Total Trend</h3>
              <p className="text-xs text-muted-foreground">Combined growth of all channels monthly.</p>

              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={REVENUE_ANALYTICS}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.gridLine} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                    formatter={(v: number) => [formatCurrency(v)]}
                  />
                  <Bar dataKey="total" fill={colors.subscription} radius={[4, 4, 0, 0]} name="Total MRR" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}
