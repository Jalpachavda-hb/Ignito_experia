import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Eye, EyeOff, ShieldAlert, MonitorSmartphone, LogOut } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export function SecuritySettings() {
  const [showPassword, setShowPassword] = useState(false)
  const { register, watch, formState: { isDirty }, reset } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      tfaEnabled: true
    }
  })

  const newPasswordVal = watch('newPassword')
  const passStrength = newPasswordVal.length > 8 ? 75 : newPasswordVal.length > 0 ? 30 : 0
  const passColor = passStrength > 50 ? 'bg-emerald-500' : 'bg-amber-500'

  return (
    <FormShell 
      title="Security Settings" 
      description="Manage your password, 2FA, and active sessions."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <div className="grid gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-md">
              <Label>Current Password</Label>
              <Input type="password" {...register('currentPassword')} />
            </div>
            
            <div className="space-y-2 max-w-md relative">
              <Label>New Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} {...register('newPassword')} />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {newPasswordVal && (
                <div className="mt-2 space-y-1">
                  <Progress value={passStrength} indicatorColor={passColor} className="h-1" />
                  <p className="text-xs text-muted-foreground text-right">
                    {passStrength > 50 ? 'Strong password' : 'Weak password'}
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-2 max-w-md">
              <Label>Confirm New Password</Label>
              <Input type="password" {...register('confirmPassword')} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
            <CardDescription>Add an extra layer of security to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-base">Authenticator App</Label>
                <p className="text-sm text-muted-foreground">Use an app like Google Authenticator to generate verification codes.</p>
              </div>
              <Switch defaultChecked={true} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>Manage devices currently logged into your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <MonitorSmartphone className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Windows PC - Chrome</p>
                  <p className="text-xs text-muted-foreground">IP: 192.168.1.45 • Active now</p>
                </div>
              </div>
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">Current Device</Badge>
            </div>
            
            <Button type="button" variant="destructive" className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" />
              Logout From All Other Devices
            </Button>
          </CardContent>
        </Card>
      </div>
    </FormShell>
  )
}
