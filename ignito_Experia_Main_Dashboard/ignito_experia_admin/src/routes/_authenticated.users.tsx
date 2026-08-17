import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Search as SearchIcon, Users as UsersIcon, RefreshCw,
  Filter, GraduationCap, ShieldCheck, Mail, Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/services/api'

export interface UserRecord {
  UserId: number
  FullName: string
  Email: string
  PhoneNumber: string
  AuthType: string
  CreatedFrom: string
  ExternalStudentId: string
  TenantId: string
  UniversityName: string
  TenantSlug: string
  Role: string
  Status: string
  EnrollmentNumber: string
  CreditBalance: number
  LastLoginAt: string
  CreatedAt: string
}

export interface UniversityTenant {
  tenantId: string
  name: string
  slug: string
}

function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTenantId, setSelectedTenantId] = useState<string>('ALL')
  const [selectedRole, setSelectedRole] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // 1. Fetch Tenant List for Dynamic University Filter Dropdown
  const { data: tenantListRes } = useQuery({
    queryKey: ['universities-filter-list'],
    queryFn: () => apiRequest<{ success: boolean; data: UniversityTenant[] }>('/admin/universities'),
  })
  const universities = tenantListRes?.data || []

  // 2. Fetch Multi-Tenant User Records from Backend with backend-enforced filters
  const { data: usersRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-users-list', page, pageSize, searchQuery, selectedTenantId, selectedRole],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedTenantId && selectedTenantId !== 'ALL' ? { tenantId: selectedTenantId } : {}),
        ...(selectedRole && selectedRole !== 'ALL' ? { role: selectedRole } : {}),
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
        <div className="flex flex-col gap-6 pb-12">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <UsersIcon className="h-6 w-6 text-primary" /> User Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage student identity records across all university tenants and filter by institution or role.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefetching && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card shadow-xs">
            <div className="relative w-full md:w-80">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Role Filter */}
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground whitespace-nowrap">
                <GraduationCap className="h-4 w-4 text-primary" /> Role:
              </div>
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer min-w-[140px]"
              >
                <option value="ALL">All Roles</option>
                <option value="Student">Student</option>
                <option value="TENANT_ADMIN">Tenant Admin</option>
              </select>

              {/* University / Tenant Filter */}
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground whitespace-nowrap ms-2">
                <Filter className="h-4 w-4 text-primary" /> University / Tenant:
              </div>
              <select
                value={selectedTenantId}
                onChange={(e) => {
                  setSelectedTenantId(e.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer min-w-[220px]"
              >
                <option value="ALL">All Users (Platform Wide)</option>
                <option value="DIRECT">Direct Experia Users (No University)</option>
                {universities.map((uni) => (
                  <option key={uni.tenantId} value={uni.tenantId}>
                    {uni.name} ({uni.slug?.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Student / User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">University / Tenant</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Credits</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading student records...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No student records found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.UserId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {user.FullName ? user.FullName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <span>{user.FullName || 'Student User'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                          {user.Email}
                        </td>
                        <td className="px-6 py-4">
                          {!user.TenantId || user.UniversityName === 'Direct Experia User' ? (
                            <div className="flex items-center gap-1.5 font-medium text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-md border border-purple-200/50 dark:border-purple-800/40 w-fit">
                              <span>Direct Experia User</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 font-medium text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-200/50 dark:border-indigo-800/40 w-fit">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span>{user.UniversityName}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                            {user.Role || 'Student'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-amber-600 dark:text-amber-400">
                          {user.CreditBalance || 0}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                              (user.Status || "Active").toLowerCase() === "active"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50"
                            )}
                          >
                            {user.Status || 'Active'}
                          </span>
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
                Showing {users.length} of {pagination.total} total students
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
    </>
  )
}

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})
