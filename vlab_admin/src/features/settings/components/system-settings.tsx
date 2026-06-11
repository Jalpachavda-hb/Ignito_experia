import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ServerCog } from 'lucide-react'

export function SystemSettings() {
  const { register, watch, formState: { isDirty }, reset, setValue } = useForm({
    defaultValues: {
      maintenanceMode: false,
      sessionTimeout: 60,
      maxConcurrent: 500,
    }
  })

  const isMaintenance = watch('maintenanceMode')

  return (
    <FormShell 
      title="System Settings" 
      description="Core platform controls and global thresholds."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <div className="grid gap-6">
        
        <Card className={`border-border/50 shadow-sm ${isMaintenance ? 'border-red-500/50 bg-red-500/5' : ''}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isMaintenance ? 'text-red-500' : ''}`}>
              <AlertTriangle className="h-5 w-5" />
              Maintenance Mode
            </CardTitle>
            <CardDescription>Restrict platform access for scheduled updates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card bg-background/50 backdrop-blur">
              <div className="space-y-0.5">
                <Label className="text-base text-foreground font-semibold">Enable Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Active sessions will be terminated and standard users will see a maintenance screen.
                </p>
              </div>
              <Switch 
                checked={isMaintenance} 
                onCheckedChange={(val) => setValue('maintenanceMode', val, { shouldDirty: true })} 
                className={isMaintenance ? 'data-[state=checked]:bg-red-500' : ''}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="h-5 w-5" />
              Global Thresholds
            </CardTitle>
            <CardDescription>System-wide limits affecting all tenants and organizations.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Idle Session Timeout (Minutes)</Label>
              <Input type="number" {...register('sessionTimeout')} />
              <p className="text-xs text-muted-foreground mt-1">Forces logout if user is inactive in the dashboard.</p>
            </div>
            
            <div className="space-y-2">
              <Label>Max Concurrent Labs</Label>
              <Input type="number" {...register('maxConcurrent')} />
              <p className="text-xs text-muted-foreground mt-1">Hard cap on total active container instances across the platform.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium">Platform Status</h3>
              <p className="text-sm text-muted-foreground mt-1">Current operational state of the Virtual Lab Environment.</p>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">
              All Systems Operational
            </Badge>
          </CardContent>
        </Card>

      </div>
    </FormShell>
  )
}
