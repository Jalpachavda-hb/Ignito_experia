import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Mail, Wallet, Clock, UserPlus, AlertTriangle, FileBarChart } from 'lucide-react'

export function NotificationSettings() {
  const { register, watch, formState: { isDirty }, reset, setValue } = useForm({
    defaultValues: {
      emailNotifications: true,
      creditAlerts: true,
      labExpiryAlerts: true,
      newUserAlerts: false,
      failedSessionAlerts: true,
      weeklyReports: false
    }
  })

  const watchAll = watch()

  return (
    <FormShell 
      title="Notification Settings" 
      description="Choose what events you want to be notified about via email or platform alerts."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-base">Master Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive administrative alerts at admin@vlab.enterprise.</p>
                </div>
              </div>
              <Switch 
                checked={watchAll.emailNotifications} 
                onCheckedChange={(val) => setValue('emailNotifications', val, { shouldDirty: true })} 
              />
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-500/10 rounded-full">
                  <Wallet className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <Label className="text-base">Credit Pool Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notify when a course or organization drops below 20% credits.</p>
                </div>
              </div>
              <Switch 
                checked={watchAll.creditAlerts} 
                onCheckedChange={(val) => setValue('creditAlerts', val, { shouldDirty: true })} 
                disabled={!watchAll.emailNotifications}
              />
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-sky-500/10 rounded-full">
                  <Clock className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <Label className="text-base">Lab Expiry Alerts</Label>
                  <p className="text-sm text-muted-foreground">Alert when long-running sessions are nearing forced termination.</p>
                </div>
              </div>
              <Switch 
                checked={watchAll.labExpiryAlerts} 
                onCheckedChange={(val) => setValue('labExpiryAlerts', val, { shouldDirty: true })} 
                disabled={!watchAll.emailNotifications}
              />
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-emerald-500/10 rounded-full">
                  <UserPlus className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <Label className="text-base">New User Registrations</Label>
                  <p className="text-sm text-muted-foreground">Daily digest of new students and faculty joining the platform.</p>
                </div>
              </div>
              <Switch 
                checked={watchAll.newUserAlerts} 
                onCheckedChange={(val) => setValue('newUserAlerts', val, { shouldDirty: true })} 
                disabled={!watchAll.emailNotifications}
              />
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <Label className="text-base">Failed Session Alerts</Label>
                  <p className="text-sm text-muted-foreground">Immediate alert if a container fails to spin up or crashes.</p>
                </div>
              </div>
              <Switch 
                checked={watchAll.failedSessionAlerts} 
                onCheckedChange={(val) => setValue('failedSessionAlerts', val, { shouldDirty: true })} 
                disabled={!watchAll.emailNotifications}
              />
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-500/10 rounded-full">
                  <FileBarChart className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <Label className="text-base">Weekly Activity Reports</Label>
                  <p className="text-sm text-muted-foreground">Receive a PDF summary of platform metrics every Monday morning.</p>
                </div>
              </div>
              <Switch 
                checked={watchAll.weeklyReports} 
                onCheckedChange={(val) => setValue('weeklyReports', val, { shouldDirty: true })} 
                disabled={!watchAll.emailNotifications}
              />
            </div>

          </div>
        </CardContent>
      </Card>
    </FormShell>
  )
}
