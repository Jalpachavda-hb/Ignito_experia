import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Building2, DollarSign, Users, Cpu, TrendingUp, Sparkles, Activity, Layers, Server,
  RefreshCw, CheckCircle2, ShoppingCart, ArrowUpRight, GraduationCap, ShieldCheck,
  CreditCard, Search, BookOpen, Clock, Tag, FlaskConical
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search as HeaderSearch } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/services/api'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

interface LabPurchaseItem {
  LabId: string
  LabTitle: string
  Category: string
  Logo: string
  StudentCount: number
  TotalPurchases: number
  TotalTokens: string | number
  TotalRevenue: string | number
}

interface StudentPurchaseTransaction {
  TransactionId: number
  UserId: number
  StudentName: string
  StudentEmail: string
  StudentPhone: string
  LabId: string
  LabTitle: string
  Credits: string | number
  Amount: string | number
  Currency: string
  PaymentReference: string
  IdempotencyKey: string
  Status: string
  PurchasedAt: string
}

interface DirectStudentItem {
  UserId: number
  FullName: string
  Email: string
  PhoneNumber: string
  Status: string
  CreatedAt: string
  CreditBalance: string | number
  TotalPurchasedCredits: string | number
  ConsumedCredits: string | number
  purchasedLabs: Array<{
    transactionId: number
    labId: string
    labTitle: string
    credits: number
    amount: number
    currency: string
    paymentReference: string
    purchasedAt: string
    status: string
  }>
  purchasedLabsCount: number
}

interface DashboardStatsResponse {
  success: boolean
  kpis: {
    directStudentsCount: number
    totalRevenue: number
    totalTokensSold: number
    totalPurchasesCount: number
    activeConcurrentLabs: number
    totalUniversitiesCount: number
    totalCatalogLabs: number
  }
  labPurchaseBreakdown: LabPurchaseItem[]
  studentLabPurchases: StudentPurchaseTransaction[]
  directStudents: DirectStudentItem[]
  monthlyRevenue: Array<{
    monthName: string
    yearMonth: string
    revenue: string | number
    credits: string | number
  }>
}

function ExecutiveCard({
  title,
  value,
  badgeText,
  subtitle,
  icon: Icon,
  accentColor,
}: {
  title: string
  value: string | number
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
      className="glass bg-card/95 rounded-2xl p-5 border border-border/70 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between group"
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

const PALETTE = ['#8b5cf6', '#10b981', '#f43f5e', '#0ea5e9', '#f59e0b', '#ec4899', '#6366f1']

export default function DashboardPage() {
  const [purchaseSearch, setPurchaseSearch] = useState('')

  // Real-time API query for Owner Dashboard
  const { data: statsRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['owner-dashboard-real-stats'],
    queryFn: () => apiRequest<DashboardStatsResponse>('/admin/dashboard/stats'),
    refetchInterval: 30000,
  })

  const kpis = statsRes?.kpis || {
    directStudentsCount: 0,
    totalRevenue: 0,
    totalTokensSold: 0,
    totalPurchasesCount: 0,
    activeConcurrentLabs: 0,
    totalUniversitiesCount: 0,
    totalCatalogLabs: 0,
  }

  const labBreakdown = statsRes?.labPurchaseBreakdown || []
  const purchases = statsRes?.studentLabPurchases || []
  const directStudents = statsRes?.directStudents || []

  // Filter purchase activity table
  const filteredPurchases = purchases.filter((p) => {
    const q = purchaseSearch.toLowerCase().trim()
    if (!q) return true
    return (
      p.StudentName?.toLowerCase().includes(q) ||
      p.StudentEmail?.toLowerCase().includes(q) ||
      p.LabTitle?.toLowerCase().includes(q) ||
      p.PaymentReference?.toLowerCase().includes(q) ||
      p.LabId?.toLowerCase().includes(q)
    )
  })

  // Format monthly revenue for Bar Chart
  const revenueChartData = (statsRes?.monthlyRevenue && statsRes.monthlyRevenue.length > 0)
    ? statsRes.monthlyRevenue.map((m) => ({
        month: m.monthName,
        revenue: Number(m.revenue || 0),
        tokens: Number(m.credits || 0),
      }))
    : [
        { month: 'Sep', revenue: Number(kpis.totalRevenue), tokens: Number(kpis.totalTokensSold) },
        { month: 'Oct', revenue: 0, tokens: 0 },
      ]

  // Donut chart data for labs purchased
  const donutData = labBreakdown.map((item, idx) => ({
    name: item.LabTitle,
    count: item.StudentCount,
    revenue: Number(item.TotalRevenue),
    color: PALETTE[idx % PALETTE.length],
  }))

  const totalDirectStudentsPurchased = labBreakdown.reduce((sum, item) => sum + item.StudentCount, 0)

  return (
    <>
      <Header>
        <HeaderSearch />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="bg-[#fcfcfc] dark:bg-background min-h-[calc(100vh-3.5rem)]">
        <div className="space-y-7 max-w-[1600px] mx-auto py-6 px-4 sm:px-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Platform Executive Dashboard
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Live Data
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Real-time metrics for direct platform students, lab purchases, and revenue breakdown. (Excludes LMS users)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="gap-2 text-xs font-semibold"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
                Refresh Real Data
              </Button>
            </div>
          </div>

          {/* Top 4 KPI Cards (Powered by Real DB Data) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <ExecutiveCard
              title="Active Direct Students"
              value={kpis.directStudentsCount}
              badgeText="Platform Direct"
              subtitle="Excluding LMS"
              icon={Users}
              accentColor="violet"
            />
            <ExecutiveCard
              title="Direct Platform Revenue"
              value={formatCurrency(kpis.totalRevenue)}
              badgeText={`${kpis.totalPurchasesCount} Orders`}
              subtitle="Razorpay Invoiced"
              icon={DollarSign}
              accentColor="emerald"
            />
            <ExecutiveCard
              title="Tokens Purchased"
              value={kpis.totalTokensSold.toLocaleString()}
              badgeText="60/Lab"
              subtitle="Direct Student Wallets"
              icon={CreditCard}
              accentColor="rose"
            />
            <ExecutiveCard
              title="Virtual Lab Templates"
              value={kpis.totalCatalogLabs}
              badgeText="Active Labs"
              subtitle="In Platform Catalog"
              icon={FlaskConical}
              accentColor="sky"
            />
          </div>

          {/* Direct Notice Pill */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200 text-xs font-medium">
            <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>Direct Student Filter Active:</strong> Currently presenting live records of platform-direct learners who registered and bought labs through Experia. University LMS tenant users are strictly separated.
            </span>
            <Link
              to="/users"
              className="ms-auto flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
            >
              View User Management <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* REQUIREMENT 1: "HOW MANY STUDENTS PURCHASED WHICH LAB" */}
          <div className="glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  How Many Students Purchased Which Lab (Lab Purchase Breakdown)
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Aggregate distribution showing distinct direct students, total orders, tokens issued, and revenue per lab template.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {labBreakdown.length} Labs Purchased
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                Loading lab purchase statistics...
              </div>
            ) : labBreakdown.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-xs">
                No lab purchase records found yet for direct students.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {labBreakdown.map((lab, index) => {
                  const studentShare = totalDirectStudentsPurchased > 0
                    ? Math.round((lab.StudentCount / totalDirectStudentsPurchased) * 100)
                    : 100
                  const color = PALETTE[index % PALETTE.length]

                  return (
                    <motion.div
                      key={lab.LabId}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            {lab.Logo ? (
                              <img src={lab.Logo} alt={lab.LabTitle} className="h-10 w-10 rounded-lg object-contain bg-muted p-1 border border-border/60" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                <BookOpen className="h-5 w-5" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                {lab.LabTitle}
                              </h4>
                              <p className="text-[11px] font-mono text-muted-foreground">
                                {lab.LabId}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/50">
                            {lab.Category || 'General'}
                          </span>
                        </div>

                        {/* Metric Grid */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-center">
                          <div className="bg-muted/40 rounded-lg p-2">
                            <span className="text-[10px] font-semibold text-muted-foreground block">Students</span>
                            <span className="text-base font-extrabold text-foreground">
                              {lab.StudentCount}
                            </span>
                          </div>
                          <div className="bg-muted/40 rounded-lg p-2">
                            <span className="text-[10px] font-semibold text-muted-foreground block">Tokens</span>
                            <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                              {Number(lab.TotalTokens).toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-muted/40 rounded-lg p-2">
                            <span className="text-[10px] font-semibold text-muted-foreground block">Revenue</span>
                            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(Number(lab.TotalRevenue))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress representation */}
                      <div className="pt-3 mt-3 border-t border-border/30">
                        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1">
                          <span>Purchase Share</span>
                          <span className="font-bold text-foreground">{studentShare}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${studentShare}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* REQUIREMENT 2: "WHICH STUDENT PURCHASED WHICH LAB" (Live Purchase Activity Feed) */}
          <div className="glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  Which Student Purchased Which Lab (Direct Student Order Log)
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Detailed individual audit trail of direct student purchases, lab titles, tokens credited, amounts, and payment references.
                </p>
              </div>

              {/* Search input for purchase log */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter student or lab name..."
                  value={purchaseSearch}
                  onChange={(e) => setPurchaseSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/50 overflow-hidden bg-background">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">STUDENT NAME & EMAIL</th>
                      <th className="px-5 py-3.5">PURCHASED LAB</th>
                      <th className="px-5 py-3.5">TOKENS CREDITED</th>
                      <th className="px-5 py-3.5">AMOUNT PAID</th>
                      <th className="px-5 py-3.5">PAYMENT REFERENCE</th>
                      <th className="px-5 py-3.5">PURCHASE DATE</th>
                      <th className="px-5 py-3.5 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1 text-primary" />
                          Loading student purchases...
                        </td>
                      </tr>
                    ) : filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                          No direct student purchases found matching the search.
                        </td>
                      </tr>
                    ) : (
                      filteredPurchases.map((txn) => (
                        <tr key={txn.TransactionId} className="hover:bg-muted/30 transition-colors">
                          {/* Student Details */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-xs shrink-0">
                                {txn.StudentName ? txn.StudentName.charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-foreground truncate">{txn.StudentName}</div>
                                <div className="text-[11px] text-muted-foreground font-mono truncate">{txn.StudentEmail}</div>
                              </div>
                            </div>
                          </td>

                          {/* Purchased Lab */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{txn.LabTitle}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">({txn.LabId})</span>
                          </td>

                          {/* Tokens */}
                          <td className="px-5 py-3.5 font-bold text-amber-600 dark:text-amber-400">
                            {Number(txn.Credits)} Tokens
                          </td>

                          {/* Amount */}
                          <td className="px-5 py-3.5 font-extrabold text-foreground">
                            {formatCurrency(Number(txn.Amount))}
                          </td>

                          {/* Payment Reference */}
                          <td className="px-5 py-3.5 font-mono text-[11px] text-muted-foreground">
                            <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/50">
                              {txn.PaymentReference || 'DIRECT_MINT'}
                            </span>
                          </td>

                          {/* Purchased Date */}
                          <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                            {txn.PurchasedAt ? new Date(txn.PurchasedAt).toLocaleString() : 'Recent'}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50">
                              <CheckCircle2 className="h-3 w-3" />
                              {txn.Status || 'SUCCESS'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 3: Revenue Bar Chart (2/3) + Top Labs Donut Chart (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Direct Platform Revenue Trend */}
            <div className="lg:col-span-2 glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Direct Platform Revenue Growth
                    <Activity className="h-4 w-4 text-emerald-500" />
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    Monthly lab purchase revenue and token volume from direct students.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Direct Revenue (₹)
                  </span>
                  <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Tokens Issued
                  </span>
                </div>
              </div>

              <div className="h-[270px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 255)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.55 0.03 250)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.55 0.03 250)' }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      formatter={(val: number, name: string) => [
                        name === 'Direct Revenue' ? formatCurrency(val) : `${val} tokens`,
                        name,
                      ]}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontWeight: 600 }}
                    />
                    <Bar dataKey="revenue" name="Direct Revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="tokens" name="Tokens Issued" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Purchased Labs Share Donut */}
            <div className="glass bg-card/95 rounded-2xl p-6 border border-border/70 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Top Purchased Environments
                  <Layers className="h-4 w-4 text-violet-500" />
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct student adoption by lab template.
                </p>
              </div>

              {donutData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                  No purchases to chart
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-[180px] w-[140px] flex-shrink-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                          dataKey="count"
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`donut-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}
                          formatter={(val: number) => [`${val} students`, 'Purchased']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                        {totalDirectStudentsPurchased}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Students</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 min-w-0">
                    {donutData.map((env) => (
                      <div key={env.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: env.color }} />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{env.name}</span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 flex-shrink-0 ml-1">
                          {env.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Total Catalog: <strong>{kpis.totalCatalogLabs} labs</strong></span>
                <Link to="/labs" className="font-bold text-primary hover:underline flex items-center gap-1">
                  Manage Labs <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </Main>
    </>
  )
}
