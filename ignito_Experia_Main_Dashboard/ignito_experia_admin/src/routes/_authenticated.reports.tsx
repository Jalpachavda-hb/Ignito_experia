import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Users, FlaskConical, Landmark, Receipt, RefreshCw, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { apiRequest, api, OWNER_API_BASE } from '@/services/api'
import { cn, formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

interface ReportsStatsResponse {
  success: boolean
  stats: {
    platformUsage: {
      studentsCount: number
    }
    labPerformance: {
      labsCount: number
    }
    revenueStatement: {
      transactionsCount: number
      totalRevenue: number
    }
    creditConsumption: {
      sessionsCount: number
      tokensConsumed: number
    }
  }
}

export default function ReportsPage() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data: statsRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['owner-reports-stats'],
    queryFn: () => apiRequest<ReportsStatsResponse>('/admin/reports'),
  })

  const stats = statsRes?.stats

  const REPORTS_LIST = [
    {
      id: 'rep-01',
      typeKey: 'platform-usage',
      title: 'Direct Student Platform Usage Report',
      desc: 'Active direct student identity records, wallet credit balances, consumed tokens, and registration timestamps.',
      meta: stats ? `${stats.platformUsage.studentsCount} Registered Direct Students` : 'Loading...',
      icon: Users,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      id: 'rep-02',
      typeKey: 'lab-performance',
      title: 'Global Lab Performance Analysis',
      desc: 'Catalog lab templates, direct student adoption counts, total orders, tokens issued, and revenue breakdown.',
      meta: stats ? `${stats.labPerformance.labsCount} Catalog Virtual Labs` : 'Loading...',
      icon: FlaskConical,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10',
    },
    {
      id: 'rep-03',
      typeKey: 'revenue-statement',
      title: 'Revenue & Transaction Statement',
      desc: 'Complete ledger of direct purchases, payment IDs, student names, lab titles, tokens, and INR amounts.',
      meta: stats ? `${stats.revenueStatement.transactionsCount} Orders (${formatCurrency(stats.revenueStatement.totalRevenue)})` : 'Loading...',
      icon: Landmark,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      id: 'rep-04',
      typeKey: 'credit-consumption',
      title: 'Credit & Session Consumption Logs',
      desc: 'Runtime session compute history, allocated vs billed tokens, duration seconds, and container exit status.',
      meta: stats ? `${stats.creditConsumption.sessionsCount} Sessions (${stats.creditConsumption.tokensConsumed} Tokens Billed)` : 'Loading...',
      icon: Receipt,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
    },
  ]

  const handleDownload = async (report: typeof REPORTS_LIST[0]) => {
    try {
      setDownloadingId(report.id)
      const res = await api.get(`/admin/reports/${report.typeKey}/export`, {
        responseType: 'blob',
      })

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${report.typeKey}_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(`${report.title} exported successfully!`)
    } catch (err: any) {
      toast.error(`Failed to export report: ${err.message || 'Download error'}`)
    } finally {
      setDownloadingId(null)
    }
  }

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
                <h1 className="text-3xl font-bold tracking-tight">Reports & Exports</h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Live Dynamic CSV
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Generate and export real-time system stats, financial audit statements, and lab diagnostic ledgers.
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
              Refresh Report Stats
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {REPORTS_LIST.map((report) => {
              const Icon = report.icon
              const isExporting = downloadingId === report.id
              return (
                <div
                  key={report.id}
                  className="glass rounded-2xl p-6 border border-border/70 shadow-xs flex flex-col justify-between h-[220px] bg-card hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center border border-border/60 shrink-0 group-hover:scale-105 transition-transform', report.bg)}>
                      <Icon className={cn('h-5 w-5', report.color)} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {report.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {report.desc}
                      </p>
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/50">
                          <CheckCircle2 className="h-3 w-3" />
                          {report.meta}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-3.5 mt-3">
                    <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">
                      {report.id} · CSV Format
                    </span>
                    <button
                      onClick={() => handleDownload(report)}
                      disabled={isExporting}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          Export CSV
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Main>
    </>
  )
}
