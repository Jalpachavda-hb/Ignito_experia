import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search as SearchIcon, Users as UsersIcon, RefreshCw,
  GraduationCap, ShieldCheck, Mail, Phone, BookOpen,
  CreditCard, CheckCircle2, ShoppingCart, Calendar,
  Receipt, ArrowUpRight, ChevronRight, Sparkles
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiRequest } from '@/services/api'

export interface PurchasedLab {
  transactionId: number
  labId: string
  labTitle: string
  credits: number
  amount: number
  currency: string
  paymentReference: string
  purchasedAt: string
  status: string
}

export interface LabWallet {
  labId: string
  totalPurchasedTokens: number
  consumedTokens: number
  remainingTokens: number
}

export interface UserRecord {
  UserId: number
  FullName: string
  Email: string
  PhoneNumber: string
  AuthType: string
  CreatedFrom: string
  TenantId: string
  UniversityName: string
  TenantSlug: string
  Role: string
  Status: string
  CreditBalance: number | string
  TotalPurchasedCredits?: number | string
  ConsumedCredits?: number | string
  CreatedAt: string
  purchasedLabs?: PurchasedLab[]
  purchasedLabsCount?: number
  labWallets?: LabWallet[]
}

function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // State for Purchase History Details Modal
  const [selectedStudentForLabs, setSelectedStudentForLabs] = useState<UserRecord | null>(null)

  // Fetch Direct Students (strictly excluding LMS students)
  const { data: usersRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-direct-users-list', page, pageSize, searchQuery, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        tenantId: 'DIRECT',
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedStatus && selectedStatus !== 'ALL' ? { status: selectedStatus } : {}),
      })
      return apiRequest<{
        success: boolean
        data: UserRecord[]
        pagination: { total: number; page: number; pageSize: number; totalPages: number }
      }>(`/admin/users?${params.toString()}`)
    },
  })

  const users = usersRes?.data || []
  const pagination = usersRes?.pagination || { total: 0, page: 1, pageSize: 10, totalPages: 1 }

  // Quick stats calculation
  const totalPurchasedLabsCount = users.reduce((sum, u) => sum + (u.purchasedLabsCount || 0), 0)
  const totalTokensCirculating = users.reduce((sum, u) => sum + Number(u.CreditBalance || 0), 0)

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className="flex flex-col gap-6 pb-12 max-w-[1600px] mx-auto py-6 px-4 sm:px-6">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <UsersIcon className="h-6 w-6 text-primary" /> Direct Student Management
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Direct Users Only
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Manage direct platform learners, track which students purchased which labs, and monitor credit balances. (LMS users excluded)
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
              Refresh Records
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border/60 bg-card shadow-xs flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                <UsersIcon className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold block">Total Direct Students</span>
                <span className="text-2xl font-extrabold text-foreground">{pagination.total}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-card shadow-xs flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold block">Lab Purchases by Students</span>
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{totalPurchasedLabsCount} Labs</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-card shadow-xs flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold block">Available Tokens in Wallets</span>
                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{totalTokensCirculating.toLocaleString()} Tokens</span>
              </div>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card shadow-xs">
            <div className="relative w-full md:w-80">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search direct student by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                Status:
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer min-w-[120px]"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* User Table with Purchased Labs */}
          <div className="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">DIRECT STUDENT</th>
                    <th className="px-6 py-4">EMAIL & PHONE</th>
                    <th className="px-6 py-4">PLATFORM ROLE</th>
                    <th className="px-6 py-4">PURCHASED LABS</th>
                    <th className="px-6 py-4">WALLET TOKENS</th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-xs">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading direct student records...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-xs">
                        No direct student records found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.UserId} className="hover:bg-muted/20 transition-colors">
                        {/* Student Name */}
                        <td className="px-6 py-4 font-semibold text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {user.FullName ? user.FullName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div>
                              <div className="font-bold text-foreground">{user.FullName || 'Direct Student'}</div>
                              <span className="text-[10px] text-muted-foreground font-mono">ID: #{user.UserId}</span>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td className="px-6 py-4 text-xs">
                          <div className="font-mono text-muted-foreground">{user.Email}</div>
                          {user.PhoneNumber && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" /> {user.PhoneNumber}
                            </div>
                          )}
                        </td>

                        {/* Role / Tenant Badge */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-md border border-violet-200/50 dark:border-violet-800/40">
                              <GraduationCap className="h-3 w-3" /> Direct Student
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">Experia Direct</span>
                          </div>
                        </td>

                        {/* Purchased Labs Badges */}
                        <td className="px-6 py-4">
                          {user.purchasedLabs && user.purchasedLabs.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {user.purchasedLabs.map((p) => (
                                <span
                                  key={p.transactionId}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60"
                                >
                                  <BookOpen className="h-3 w-3 text-indigo-500" />
                                  {p.labTitle}
                                  <span className="text-[10px] font-medium text-indigo-500">({p.credits}T)</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No purchases yet</span>
                          )}
                        </td>

                        {/* Wallet Balance */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-amber-600 dark:text-amber-400">
                            {Number(user.CreditBalance || 0)} Tokens
                          </div>
                          {Number(user.ConsumedCredits || 0) > 0 && (
                            <span className="text-[10px] text-muted-foreground block">
                              {Number(user.ConsumedCredits)} consumed
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                              (user.Status || "Active").toLowerCase() === "active"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50"
                            )}
                          >
                            {user.Status || 'Active'}
                          </span>
                        </td>

                        {/* Actions: View Purchase Details */}
                        <td className="px-6 py-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedStudentForLabs(user)}
                            className="text-xs font-semibold text-primary hover:text-primary/80 hover:bg-primary/10 gap-1"
                          >
                            View Details <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Showing {users.length} of {pagination.total} direct students
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-xs font-medium px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Main>

      {/* Student Lab Purchases Details Dialog Modal */}
      <Dialog open={!!selectedStudentForLabs} onOpenChange={(open) => !open && setSelectedStudentForLabs(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Student Lab Purchases & Wallet Breakdown
            </DialogTitle>
          </DialogHeader>

          {selectedStudentForLabs && (
            <div className="space-y-4 pt-2">
              {/* Student Header Summary */}
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{selectedStudentForLabs.FullName}</h4>
                  <p className="text-xs font-mono text-muted-foreground">{selectedStudentForLabs.Email}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-muted-foreground block">Wallet Balance</span>
                  <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                    {selectedStudentForLabs.CreditBalance} Tokens
                  </span>
                </div>
              </div>

              {/* Purchased Labs Table */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-primary" />
                  Purchased Labs & Order Transactions
                </h5>

                {selectedStudentForLabs.purchasedLabs && selectedStudentForLabs.purchasedLabs.length > 0 ? (
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/50">
                        <tr>
                          <th className="p-3">LAB NAME</th>
                          <th className="p-3">TOKENS</th>
                          <th className="p-3">AMOUNT</th>
                          <th className="p-3">PAYMENT REF</th>
                          <th className="p-3">PURCHASE DATE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {selectedStudentForLabs.purchasedLabs.map((lab) => (
                          <tr key={lab.transactionId} className="hover:bg-muted/20">
                            <td className="p-3 font-semibold text-foreground">
                              {lab.labTitle}
                              <span className="text-[10px] text-muted-foreground font-mono block">({lab.labId})</span>
                            </td>
                            <td className="p-3 font-bold text-amber-600 dark:text-amber-400">
                              {lab.credits} Tokens
                            </td>
                            <td className="p-3 font-bold text-foreground">
                              {formatCurrency(lab.amount)}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-muted-foreground">
                              {lab.paymentReference}
                            </td>
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {new Date(lab.purchasedAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    No lab purchases recorded for this student yet.
                  </p>
                )}
              </div>

              {/* Lab Token Wallets (Remaining / Consumed per lab) */}
              {selectedStudentForLabs.labWallets && selectedStudentForLabs.labWallets.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-emerald-500" />
                    Individual Lab Token Wallets (Live Balance)
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedStudentForLabs.labWallets.map((lw) => (
                      <div key={lw.labId} className="p-3 rounded-lg border border-border/50 bg-background flex flex-col justify-between">
                        <span className="font-bold text-xs capitalize text-foreground">{lw.labId} Lab</span>
                        <div className="flex items-center justify-between text-xs mt-2">
                          <span className="text-muted-foreground">Remaining:</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{lw.remainingTokens} Tokens</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                          <span>Consumed:</span>
                          <span>{lw.consumedTokens} Tokens</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})
