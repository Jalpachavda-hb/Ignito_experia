import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, Filter, RefreshCw, ShoppingCart, CheckCircle2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/services/api'

export const Route = createFileRoute('/_authenticated/transactions')({
  component: TransactionsPage,
})

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

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  const { data: statsRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['owner-transactions-list'],
    queryFn: () => apiRequest<{ success: boolean; studentLabPurchases: StudentPurchaseTransaction[] }>('/admin/dashboard/stats'),
  })

  const rawPurchases = statsRes?.studentLabPurchases || []

  const transactions = rawPurchases.map((p) => ({
    id: p.PaymentReference || `TXN-${p.TransactionId}`,
    student: p.StudentName || `Student #${p.UserId}`,
    email: p.StudentEmail,
    type: 'Direct Lab Purchase',
    labTitle: p.LabTitle,
    tokens: Number(p.Credits),
    amount: Number(p.Amount),
    date: p.PurchasedAt ? new Date(p.PurchasedAt).toLocaleDateString() : 'Recent',
    status: p.Status || 'Completed',
  }))

  const filteredTxns = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      t.student.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.labTitle.toLowerCase().includes(q)

    const matchesType =
      filterType === 'all' ||
      (filterType === 'direct_purchase' && t.type === 'Direct Lab Purchase')

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
                Real-time audit log of direct student lab purchases, token orders, and Razorpay payment references.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
              Refresh Transactions
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student, lab or payment ID..."
                className="pl-10 rounded-full bg-secondary/30 border border-border/50 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 h-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 rounded-full bg-card border border-border/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">All Types</option>
                <option value="direct_purchase">Direct Lab Purchases</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border/60 overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-4 px-6">PAYMENT / TXN ID</th>
                    <th className="py-4 px-6">DIRECT STUDENT</th>
                    <th className="py-4 px-6">TRANSACTION TYPE</th>
                    <th className="py-4 px-6">PURCHASED LAB & TOKENS</th>
                    <th className="py-4 px-6 text-right">AMOUNT</th>
                    <th className="py-4 px-6 text-center">STATUS</th>
                    <th className="py-4 px-6">DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading transaction audit log...
                      </td>
                    </tr>
                  ) : filteredTxns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                        No transaction records found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTxns.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-xs text-foreground">{t.id}</td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-foreground">{t.student}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{t.email}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs font-semibold px-3 py-1 rounded-full border inline-block bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20">
                            {t.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-foreground font-medium">
                          {t.labTitle}
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-bold block">
                            {t.tokens} Tokens
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-foreground font-mono">
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="text-xs font-semibold px-3 py-1 rounded-full border inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
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

            {/* Pagination / Total count Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border/60 bg-muted/20 text-xs font-medium">
              <span className="text-muted-foreground">
                Showing {filteredTxns.length} direct purchase transaction records
              </span>
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}
