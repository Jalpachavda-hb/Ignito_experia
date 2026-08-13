import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Landmark, CreditCard, DollarSign, TrendingUp } from 'lucide-react'
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
  { month: 'Jul', total: 280000 },
  { month: 'Aug', total: 310000 },
  { month: 'Sep', total: 295000 },
  { month: 'Oct', total: 340000 },
  { month: 'Nov', total: 360000 },
  { month: 'Dec', total: 390000 },
  { month: 'Jan', total: 355000 },
  { month: 'Feb', total: 380000 },
]

const CREDIT_CONSUMPTION_DATA = [
  { date: 'Jul 24', allocated: 680, consumed: 320 },
  { date: 'Jul 25', allocated: 790, consumed: 510 },
  { date: 'Jul 26', allocated: 890, consumed: 720 },
  { date: 'Jul 27', allocated: 610, consumed: 110 },
  { date: 'Jul 28', allocated: 810, consumed: 180 },
  { date: 'Jul 29', allocated: 820, consumed: 140 },
  { date: 'Jul 30', allocated: 719, consumed: 610 },
  { date: 'Jul 31', allocated: 850, consumed: 610 },
  { date: 'Aug 1', allocated: 650, consumed: 260 },
  { date: 'Aug 2', allocated: 760, consumed: 330 },
  { date: 'Aug 3', allocated: 830, consumed: 210 },
  { date: 'Aug 4', allocated: 840, consumed: 380 },
  { date: 'Aug 5', allocated: 940, consumed: 650 },
  { date: 'Aug 6', allocated: 960, consumed: 450 },
]

function CurvedCornerCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  accentColor: 'rose' | 'violet' | 'emerald' | 'sky'
}) {
  const colorMap = {
    rose: { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', valueText: 'text-foreground' },
    violet: { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', valueText: 'text-foreground' },
    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', valueText: 'text-emerald-600' },
    sky: { bg: 'bg-sky-500/15', text: 'text-sky-600 dark:text-sky-400', valueText: 'text-foreground' },
  }

  const active = colorMap[accentColor]

  return (
    <div className="relative overflow-hidden glass rounded-2xl p-5 border border-border/60 shadow-sm transition-all hover:shadow-md bg-card">
      <div className={cn('absolute top-0 right-0 h-16 w-16 rounded-bl-full flex items-start justify-end p-3.5', active.bg)}>
        <Icon className={cn('h-4 w-4', active.text)} />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      <p className={cn('text-2xl sm:text-3xl font-bold mt-3 tracking-tight', active.valueText)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</p>
    </div>
  )
}

function CustomCreditTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const allocated = payload.find((p: any) => p.dataKey === 'allocated')?.value
    const consumed = payload.find((p: any) => p.dataKey === 'consumed')?.value
    return (
      <div className="bg-card border border-border/80 rounded-xl p-3 shadow-lg text-xs space-y-1.5 min-w-[140px]">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-blue-500 font-medium flex items-center justify-between">
          <span>allocated :</span>
          <span className="font-bold">{allocated}</span>
        </p>
        <p className="text-rose-500 font-medium flex items-center justify-between">
          <span>consumed :</span>
          <span className="font-bold">{consumed}</span>
        </p>
      </div>
    )
  }
  return null
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

      <Main className="bg-[#fcfcfc] dark:bg-background min-h-[calc(100vh-3.5rem)]">
        <div className="space-y-6 max-w-[1600px] mx-auto py-6 px-4 sm:px-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Revenue & Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Detailed platform monetization analytics, MRR tracker, and category-wise performance reports.
            </p>
          </div>

          {/* Top 4 Curved Corner Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CurvedCornerCard
              title="YTD SaaS Subscriptions"
              value={formatCurrency(1770000)}
              subtitle="+18.4% YoY growth"
              icon={Landmark}
              accentColor="rose"
            />
            <CurvedCornerCard
              title="YTD Credits Revenue"
              value={formatCurrency(940000)}
              subtitle="+12.1% vs last month"
              icon={CreditCard}
              accentColor="violet"
            />
            <CurvedCornerCard
              title="Total Revenue Generated"
              value={formatCurrency(2710000)}
              subtitle="+15.8% overall surge"
              icon={DollarSign}
              accentColor="emerald"
            />
            <CurvedCornerCard
              title="Average Contract Value"
              value={formatCurrency(185000)}
              subtitle="+6.2% tier expansion"
              icon={TrendingUp}
              accentColor="sky"
            />
          </div>

          {/* Middle Grid: Credit Consumption (2/3 width) + MRR Total Trend (1/3 width) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Credit Consumption Dual Area Chart (dot={false} so dots only appear on cursor hover) */}
            <div className="lg:col-span-2 glass rounded-2xl p-6 border border-border/60 shadow-sm space-y-4 bg-card">
              <div>
                <h3 className="text-base font-bold text-foreground">Credit Consumption</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Daily compute credits burned vs allocated (Last 14 days)
                </p>
              </div>

              <div className="h-[280px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CREDIT_CONSUMPTION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="allocGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="consGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.929 0.013 255.508)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'oklch(0.55 0.04 250)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'oklch(0.55 0.04 250)' }} domain={[0, 1000]} ticks={[0, 250, 500, 750, 1000]} />
                    <Tooltip content={<CustomCreditTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="allocated"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#allocGrad)"
                      dot={false}
                      activeDot={{ fill: '#3b82f6', r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                      name="allocated"
                    />
                    <Area
                      type="monotone"
                      dataKey="consumed"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      fill="url(#consGrad)"
                      dot={false}
                      activeDot={{ fill: '#f43f5e', r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                      name="consumed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* MRR Total Trend Bar Chart */}
            <div className="glass rounded-2xl p-6 border border-border/60 shadow-sm space-y-4 bg-card flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">MRR Total Trend</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Combined growth of all channels monthly.</p>
              </div>

              <div className="h-[270px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={REVENUE_ANALYTICS} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity={0.65} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.929 0.013 255.508)" />
                    <XAxis dataKey="month" tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'oklch(0.55 0.04 250)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                      formatter={(v: number) => [formatCurrency(v)]}
                    />
                    <Bar dataKey="total" fill="url(#barGrad)" radius={[6, 6, 0, 0]} name="Total MRR" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </Main>
    </>
  )
}
