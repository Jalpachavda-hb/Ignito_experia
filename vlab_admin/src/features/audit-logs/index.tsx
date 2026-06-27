import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AuditLogsTable } from './components/audit-logs-table'
import { AuditLogsFilters } from './components/audit-logs-filters'
import { AuditLogsProvider } from './context/audit-logs-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, ShieldAlert, KeyRound } from 'lucide-react'
import { useState, useEffect } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { type AuditLog } from './data/schema'

function AuditLogsViewContent() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState({ totalLogs: 0, failedLogins: 0, destructiveActions: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch Stats
      try {
        const statsRes = await apiRequest('/admin/audit/statistics');
        if (statsRes?.success) {
          const statsData = statsRes.statistics;
          setStats({
            totalLogs: statsData.totalLogs || 0,
            failedLogins: (statsData.byAction?.FAILED_LOGIN || 0) + (statsData.byAction?.LOGIN_FAILED || 0),
            destructiveActions: (statsData.byAction?.DELETE || 0) + (statsData.byAction?.FORCE_LOGOUT_BY_ADMIN || 0)
          });
        }
      } catch (err) {
        console.error("Failed to fetch audit stats", err);
      }

      // Fetch Logs
      try {
        let logsRes = await apiRequest('/admin/audit');
        if (typeof logsRes === 'string') {
          try {
            logsRes = JSON.parse(logsRes);
          } catch(e) {
            console.error("Failed to parse logsRes JSON", e);
          }
        }
        
        if (logsRes?.success) {
          const mappedLogs: AuditLog[] = (logsRes.data || []).map((item: any) => {
            let parsedDate = new Date();
            if (item.CreatedAt) {
              // Fix potential missing dashes in SQL output "2026 06 25T..."
              const fixedDateStr = String(item.CreatedAt).replace(/^(\d{4}) (\d{2}) (\d{2})T/, '$1-$2-$3T');
              const d = new Date(fixedDateStr);
              if (!isNaN(d.getTime())) parsedDate = d;
            }
            
            return {
              id: String(item.LogId || item.Id || Math.random()),
              timestamp: parsedDate,
              user: {
                id: String(item.UserId || item.StudentProfileId || 'System'),
                name: item.UserFullName || (item.StudentProfileId ? `Student ${item.StudentProfileId}` : (item.UserId ? `User ${item.UserId}` : 'System')),
                email: item.UserEmail || 'N/A'
              },
              action: item.Action || 'READ',
              module: item.Module || 'Auth',
              category: item.Category || 'Authentication',
              description: item.Description || `${item.Action} on ${item.Module}`,
              userAgent: `${item.Browser || 'unknown'} / ${item.OperatingSystem || 'unknown'}`,
              payload: item.NewValues || null
            };
          });
          setLogs(mappedLogs);
        } else {
          console.warn("logsRes.success is false or undefined:", logsRes);
        }
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
      }
      
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main className="bg-background">
        <div className='mb-6 flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Security & Audit Logs</h1>
            <p className='text-muted-foreground mt-1 font-mono text-sm'>
              Immutable ledger of administrative actions and security events.
            </p>
          </div>
        </div>

        {/* Security Metrics */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.totalLogs}</div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Authentications</CardTitle>
              <KeyRound className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono">{stats.failedLogins}</div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Destructive Actions</CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">{stats.destructiveActions}</div>
            </CardContent>
          </Card>
        </div>

        <AuditLogsFilters />

        <div className='flex-1 m-0 flex flex-col min-h-0 overflow-hidden'>
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">Loading audit logs...</div>
          ) : (
            <AuditLogsTable data={logs} />
          )}
        </div>
      </Main>
    </>
  )
}

export default function AuditLogsView() {
  return (
    <AuditLogsProvider>
      <AuditLogsViewContent />
    </AuditLogsProvider>
  )
}
