import { createFileRoute } from '@tanstack/react-router'
import { Download, Building2, FlaskConical, Landmark, Receipt } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

const REPORTS_LIST = [
  { id: 'rep-01', title: 'University Platform Usage Report', desc: 'Active student counts, credits consumed, and semester structures across all colleges.', icon: Building2, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { id: 'rep-02', title: 'Global Lab Performance Analysis', desc: 'Usage logs, runtime container durations, and cost mapping per workspace image.', icon: FlaskConical, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { id: 'rep-03', title: 'Revenue & Transaction Statement', desc: 'YTD collection history, monthly MRR invoices, credit top-ups, and subscription schedules.', icon: Landmark, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'rep-04', title: 'Credit consumption logs', desc: 'Hourly tracking of student credits run logs, refund triggers, and inactive allocations.', icon: Receipt, color: 'text-sky-400', bg: 'bg-sky-500/10' },
]

export default function ReportsPage() {
  const handleDownload = (title: string) => {
    alert(`Downloading report: ${title}.CSV file generation started.`)
  }

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
            <h1 className="text-3xl font-bold tracking-tight">Reports & Exports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Export system stats and diagnostic ledgers for external audit and optimization reviews.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS_LIST.map(report => {
              const Icon = report.icon
              return (
                <div
                  key={report.id}
                  className="glass rounded-2xl p-5 border border-border flex flex-col justify-between h-[200px]"
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center border border-border ${report.bg}`}>
                      <Icon className={`h-5 w-5 ${report.color}`} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{report.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-3">
                    <span className="text-[10px] text-muted-foreground font-mono">{report.id}</span>
                    <button
                      onClick={() => handleDownload(report.title)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
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
