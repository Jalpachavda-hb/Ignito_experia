import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Coins, Plus, Minus, History, RefreshCw, Landmark } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/credits')({
  component: CreditsPage,
})

const UNIVERSITIES_LEDGER = [
  { id: '1', name: 'Pune Tech University', balance: 125000, plan: 'Enterprise' },
  { id: '2', name: 'Mumbai Digital Institute', balance: 78000, plan: 'Standard' },
  { id: '3', name: 'Bangalore CS Academy', balance: 95000, plan: 'Enterprise' },
  { id: '4', name: 'Delhi Innovation College', balance: 24000, plan: 'Basic' },
  { id: '5', name: 'Chennai Engineering College', balance: 62000, plan: 'Standard' },
]

const CREDIT_HISTORY = [
  { id: 'TXN-001', university: 'Pune Tech University', amount: 50000, type: 'credit', desc: 'Enterprise annual top-up package', date: '2026-06-28 11:24' },
  { id: 'TXN-002', university: 'Mumbai Digital Institute', amount: 15000, type: 'credit', desc: 'Standard plan expansion package', date: '2026-06-27 15:40' },
  { id: 'TXN-003', university: 'Delhi Innovation College', amount: 5000, type: 'debit', desc: 'Semester rollback adjustment', date: '2026-06-25 09:12' },
  { id: 'TXN-004', university: 'Bangalore CS Academy', amount: 20000, type: 'credit', desc: 'Bonus trial credits conversion', date: '2026-06-22 17:33' },
]

export default function CreditsPage() {
  const [selectedUni, setSelectedUni] = useState<typeof UNIVERSITIES_LEDGER[0] | null>(null)
  const [amount, setAmount] = useState<number>(10000)
  const [desc, setDesc] = useState('')

  const handleTransaction = (type: 'credit' | 'debit') => {
    if (!selectedUni) return
    alert(`Successfully ${type === 'credit' ? 'allocated' : 'reclaimed'} ${amount.toLocaleString()} credits to ${selectedUni.name}`)
    setSelectedUni(null)
    setDesc('')
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Credit Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Allocate compute run credits, view usage limits, and execute balance adjustments.
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border text-xs font-semibold hover:bg-accent transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Balances
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="glass rounded-2xl p-5 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-4">University Credit Ledger</h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase">University</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase">Plan</th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase">Credit Balance</th>
                        <th className="px-4 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {UNIVERSITIES_LEDGER.map(uni => (
                        <tr key={uni.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 text-xs font-semibold text-foreground">{uni.name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{uni.plan}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold font-mono text-foreground">{formatNumber(uni.balance)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedUni(uni)}
                              className="px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold transition-colors"
                            >
                              Adjust Balance
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass rounded-2xl p-5 border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Recent Adjustments Log</h3>
                </div>
                <div className="space-y-3">
                  {CREDIT_HISTORY.map(log => (
                    <div key={log.id} className="flex items-start justify-between p-3 rounded-xl bg-secondary/30 border border-border/30">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'h-7 w-7 rounded-lg flex items-center justify-center border',
                          log.type === 'credit' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-destructive/10 border-destructive/20 text-destructive'
                        )}>
                          {log.type === 'credit' ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{log.university}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{log.desc}</p>
                          <p className="text-[9px] text-muted-foreground font-mono mt-1">{log.date} · {log.id}</p>
                        </div>
                      </div>
                      <span className={cn(
                        'text-xs font-bold font-mono',
                        log.type === 'credit' ? 'text-emerald-400' : 'text-destructive'
                      )}>
                        {log.type === 'credit' ? '+' : '-'}{formatNumber(log.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-border h-fit space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Coins className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Adjust Credits Balance</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Direct manual ledger entries.</p>
                </div>
              </div>

              {selectedUni ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-secondary/50 border border-border p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Selected University</p>
                    <p className="text-xs font-bold text-foreground">{selectedUni.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">Current Balance: {selectedUni.balance.toLocaleString()}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Adjust Amount (Credits)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Reason / Comments</label>
                    <textarea
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      placeholder="Reason for change..."
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTransaction('debit')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive text-xs font-semibold transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5" /> Reclaim
                    </button>
                    <button
                      onClick={() => handleTransaction('credit')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Plus className="h-3.5 w-3.5" /> Allocate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border gap-2 text-center">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Select a university from the ledger to adjust credit bounds.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}
