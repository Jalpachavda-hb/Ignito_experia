import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Landmark, CreditCard, DollarSign, TrendingUp, RefreshCw, Sparkles, Activity } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/services/api'

export const Route = createFileRoute('/_authenticated/revenue')({
  component: RevenuePage,
})

interface RevenueStatsResponse {
  success: boolean
  kpis: {
    totalRevenue: number
    ytdCreditsRevenue: number
    ytdSaaSSubscriptions: number
    avgContractValue: number
    totalOrders: number
    totalTokensSold: number
    totalTokensConsumed: number
    totalTokensRemaining: number
  }
  creditConsumption: Array<{
    date: string
    allocated: number
    consumed: number
  }>
  mrrTrend: Array<{
    month: string
    total: number
    tokens: number
  }>
}

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
    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', valueText: 'text-emerald-600 dark:text-emerald-400' },
    sky: { bg: 'bg-sky-500/15', text: 'text-sky-600 dark:text-sky-400', valueText: 'text-foreground' },
  }

  const active = colorMap[accentColor]

  return (
    <div className="relative overflow-hidden glass rounded-2xl p-5 border border-border/60 shadow-xs transition-all hover:shadow-md bg-card">
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

function CustomMRRTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const total = payload[0]?.value || 0
    return (
      <div className="bg-card border border-border/80 rounded-xl p-3 shadow-lg text-xs space-y-1 min-w-[140px]">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-rose-500 font-bold flex items-center justify-between">
          <span>Revenue:</span>
          <span>{formatCurrency(total)}</span>
        </p>
      </div>
    )
  }
  return null
}

export default function RevenuePage() {
  const { data: revData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['owner-revenue-stats'],
    queryFn: () => apiRequest<RevenueStatsResponse>('/admin/revenue/stats'),
    refetchInterval: 30000,
  })

  const kpis = revData?.kpis || {
    totalRevenue: 0,
    ytdCreditsRevenue: 0,
    ytdSaaSSubscriptions: 0,
    avgContractValue: 0,
    totalOrders: 0,
    totalTokensSold: 0,
    totalTokensConsumed: 0,
    totalTokensRemaining: 0,
  }

  const consumptionData = revData?.creditConsumption || []
  const mrrData = revData?.mrrTrend || []

  return (
    <>
      <Header>
        <Search />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className="space-y-6 max-w-[1600px] mx-auto py-6 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Revenue & Analytics</h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Live Platform Data
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Detailed platform monetization analytics, token orders tracker, and runtime compute consumption.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-2 text-xs font-semibold"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
              Refresh Analytics
            </Button>
          </div>

          {/* Top 4 KPI Cards (Dynamic) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CurvedCornerCard
              title="Direct Orders Placed"
              value={`${kpis.totalOrders} Purchases`}
              subtitle={`${kpis.totalTokensSold} tokens sold`}
              icon={Landmark}
              accentColor="rose"
            />
            <CurvedCornerCard
              title="Direct Credits Revenue"
              value={formatCurrency(kpis.ytdCreditsRevenue)}
              subtitle="Razorpay Invoiced"
              icon={CreditCard}
              accentColor="violet"
            />
            <CurvedCornerCard
              title="Total Revenue Generated"
              value={formatCurrency(kpis.totalRevenue)}
              subtitle="Platform Direct Sales"
              icon={DollarSign}
              accentColor="emerald"
            />
            <CurvedCornerCard
              title="Average Order Value"
              value={formatCurrency(kpis.avgContractValue)}
              subtitle="Per direct lab purchase"
              icon={TrendingUp}
              accentColor="sky"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Credit Consumption Area Chart */}
            <div className="lg:col-span-2 glass rounded-2xl p-6 border border-border/60 shadow-xs bg-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Credit & Token Consumption
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Compute credits burned during lab runtime sessions vs total allocated tokens.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-blue-500 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Allocated ({kpis.totalTokensSold})
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-500 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Consumed ({kpis.totalTokensConsumed})
                  </span>
                </div>
              </div>

              <div className="h-[280px] w-full pt-2">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary mr-2" /> Loading consumption history...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={consumptionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAllocated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorConsumed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 255)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0.03 250)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0.03 250)' }} />
                      <Tooltip content={<CustomCreditTooltip />} />
                      <Area type="monotone" dataKey="allocated" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAllocated)" />
                      <Area type="monotone" dataKey="consumed" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorConsumed)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* MRR Trend Bar Chart */}
            <div className="glass rounded-2xl p-6 border border-border/60 shadow-xs bg-card space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">MRR / Revenue Trend</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Combined monthly collection from direct lab purchases.
                </p>
              </div>

              <div className="h-[280px] w-full pt-2">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary mr-2" /> Loading trend...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mrrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 255)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0.03 250)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0.03 250)' }} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip content={<CustomMRRTooltip />} />
                      <Bar dataKey="total" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        </div>
      </Main>
    </>
  )
}
