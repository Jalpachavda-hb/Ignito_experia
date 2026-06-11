import { FormShell } from './form-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Clock, Key, UserCheck, Activity } from 'lucide-react'

export function AuditInfoSettings() {
  
  // Note: This is an informational page, so we use a dummy submit handler
  // that won't actually trigger the "unsaved changes" since there are no inputs.
  const preventSubmit = (e: React.FormEvent) => e.preventDefault()

  return (
    <FormShell 
      title="Audit Information" 
      description="View security and lifecycle metadata about your admin account."
      onSubmit={preventSubmit}
    >
      <div className="grid gap-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/50 shadow-sm bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Last Login
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold font-mono">Today, 08:42 AM</div>
              <p className="text-xs text-muted-foreground mt-1">IP: 192.168.1.45 (Windows PC)</p>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm bg-muted/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Key className="h-4 w-4" />
                Last Password Change
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold font-mono">45 Days Ago</div>
              <p className="text-xs text-muted-foreground mt-1">Requires rotation in 45 days.</p>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm bg-muted/10 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Account Created Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold font-mono">October 12, 2024</div>
              <p className="text-xs text-muted-foreground mt-1">Created by System Administrator (root)</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Personal Activities
            </CardTitle>
            <CardDescription>The last 5 actions performed by your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'UPDATE', module: 'System Settings', time: '10 mins ago' },
                { action: 'LOGIN_SUCCESS', module: 'Auth', time: '2 hours ago' },
                { action: 'EXPORT', module: 'Audit Logs', time: '1 day ago' },
                { action: 'CREATE', module: 'Users', time: '3 days ago' },
                { action: 'DELETE', module: 'Labs', time: '5 days ago' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-md bg-card text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant={
                      activity.action === 'UPDATE' ? 'secondary' : 
                      activity.action === 'DELETE' ? 'destructive' : 'default'
                    } className="font-mono text-[10px]">
                      {activity.action}
                    </Badge>
                    <span className="font-medium text-muted-foreground">{activity.module}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </FormShell>
  )
}
