import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Search as SearchIcon, Filter, RefreshCw } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/transactions')({
  component: TransactionsPage,
})

const TRANSACTIONS = [
  { id: 'TXN-90231', university: 'Pune Tech University', type: 'subscription', plan: 'Enterprise Plan Year 1', amount: 350000, date: '2026-06-28 11:24', status: 'completed' },
  { id: 'TXN-90230', university: 'Mumbai Digital Institute', type: 'credit_purchase', plan: '50,000 Labs Pack', amount: 45000, date: '2026-06-27 15:40', status: 'completed' },
  { id: 'TXN-90229', university: 'Bangalore CS Academy', type: 'subscription', plan: 'Enterprise Plan Q3 Renewal', amount: 95000, date: '2026-06-25 09:12', status: 'completed' },
  { id: 'TXN-90228', university: 'Delhi Innovation College', type: 'credit_purchase', plan: '10,000 Labs Pack', amount: 10000, date: '2026-06-22 17:33', status: 'completed' },
  { id: 'TXN-90227', university: 'Chennai Engineering College', type: 'subscription', plan: 'Standard Plan Year 1', amount: 180000, date: '2026-06-20 14:10', status: 'completed' },
  { id: 'TXN-90226', university: 'Pune Tech University', type: 'credit_purchase', plan: '100,000 Labs Extra', amount: 80000, date: '2026-06-18 10:05', status: 'pending' },
]

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  const filteredTxns = TRANSACTIONS.filter(t => {
    const matchesSearch = t.university.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || t.type === filterType
    return matchesSearch && matchesType
  })

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Transaction Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time audit log of SaaS subscription invoices and institutional package top-ups.
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-xs font-semibold hover:bg-accent transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Ledger
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div className="relative w-full max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by college or txn ID..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none pr-8 relative"
              >
                <option value="all">All Types</option>
                <option value="subscription">Subscriptions</option>
                <option value="credit_purchase">Credit Purchases</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction ID</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">University</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No transaction records match the filters.
                    </td>
                  </tr>
                ) : (
                  filteredTxns.map(t => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/15 transition-colors">
                      <td className="px-4 py-3.5 text-sm font-mono font-semibold text-foreground">{t.id}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-foreground">{t.university}</td>
                      <td className="px-4 py-3.5 text-sm">
                        <span className={cn(
                          'text-xs font-bold px-2.5 py-0.5 rounded-full capitalize border',
                          t.type === 'subscription' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                        )}>
                          {t.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-foreground">{t.plan}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-foreground font-bold font-mono">{formatCurrency(t.amount)}</td>
                      <td className="px-4 py-3.5 text-center text-sm">
                        <span className={cn(
                          'text-xs font-bold px-2.5 py-0.5 rounded-full capitalize border',
                          t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        )}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground font-mono">{t.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Main>
    </>
  )
}
