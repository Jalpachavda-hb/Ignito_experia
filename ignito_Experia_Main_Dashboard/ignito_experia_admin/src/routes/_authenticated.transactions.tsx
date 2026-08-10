import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Search as SearchIcon, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated/transactions')({
  component: TransactionsPage,
})

const TRANSACTIONS = [
  { id: 'TXN-90231', university: 'Pune Tech University', type: 'Subscription', plan: 'Enterprise Plan Year 1', amount: 350000, date: '2026-06-28 11:24', status: 'Completed' },
  { id: 'TXN-90230', university: 'Mumbai Digital Institute', type: 'Credit Purchase', plan: '50,000 Labs Pack', amount: 45000, date: '2026-06-27 15:40', status: 'Completed' },
  { id: 'TXN-90229', university: 'Bangalore CS Academy', type: 'Subscription', plan: 'Enterprise Plan Q3 Renewal', amount: 95000, date: '2026-06-25 09:12', status: 'Completed' },
  { id: 'TXN-90228', university: 'Delhi Innovation College', type: 'Credit Purchase', plan: '10,000 Labs Pack', amount: 10000, date: '2026-06-22 17:33', status: 'Completed' },
  { id: 'TXN-90227', university: 'Chennai Engineering College', type: 'Subscription', plan: 'Standard Plan Year 1', amount: 180000, date: '2026-06-20 14:10', status: 'Completed' },
  { id: 'TXN-90226', university: 'Pune Tech University', type: 'Credit Purchase', plan: '100,000 Labs Extra', amount: 80000, date: '2026-06-18 10:05', status: 'Pending' },
]

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  const filteredTxns = TRANSACTIONS.filter(t => {
    const matchesSearch = t.university.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || t.type.toLowerCase().replace(' ', '_') === filterType.toLowerCase()
    return matchesSearch && matchesType
  })

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
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Transaction Management</h1>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Real-time audit log of SaaS subscription invoices and institutional credit package purchases.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by college or txn ID..."
                className="pl-10 rounded-full bg-secondary/30 border border-border/50 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 h-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-4 py-2 rounded-full bg-card border border-border/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">All Types</option>
                <option value="subscription">Subscription</option>
                <option value="credit_purchase">Credit Purchase</option>
              </select>
            </div>
          </div>

          {/* Table Matching SS2 & SS1 Design */}
          <div className="rounded-2xl border border-border/60 overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-4 px-6">TRANSACTION ID</th>
                    <th className="py-4 px-6">UNIVERSITY</th>
                    <th className="py-4 px-6">TYPE</th>
                    <th className="py-4 px-6">DETAILS</th>
                    <th className="py-4 px-6 text-right">AMOUNT</th>
                    <th className="py-4 px-6 text-center">STATUS</th>
                    <th className="py-4 px-6">DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredTxns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                        No transaction records found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTxns.map(t => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-xs text-foreground">{t.id}</td>
                        <td className="py-4 px-6 font-bold text-foreground">{t.university}</td>
                        <td className="py-4 px-6">
                          <span className={cn(
                            'text-xs font-semibold px-3 py-1 rounded-full border inline-block',
                            t.type === 'Subscription'
                              ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          )}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-foreground font-medium">{t.plan}</td>
                        <td className="py-4 px-6 text-right font-bold text-foreground font-mono">{formatCurrency(t.amount)}</td>
                        <td className="py-4 px-6 text-center">
                          <span className={cn(
                            'text-xs font-semibold px-3 py-1 rounded-full border inline-block',
                            t.status === 'Completed'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          )}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-xs text-muted-foreground font-mono">{t.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar Matching SS1 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border/60 bg-muted/20 text-xs font-medium">
              <div className="flex items-center gap-2">
                <select className="px-2.5 py-1 rounded-lg border border-border bg-card text-xs focus:outline-none">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <span className="text-muted-foreground">Rows per page</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">Page 1 of 1</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground" disabled>
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground" disabled>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground font-bold rounded-md">
                    1
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground" disabled>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground" disabled>
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </Main>
    </>
  )
}
