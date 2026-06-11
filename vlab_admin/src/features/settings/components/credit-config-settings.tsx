import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Wallet, Info } from 'lucide-react'

export function CreditConfigSettings() {
  const { register, watch, formState: { isDirty }, reset, setValue } = useForm({
    defaultValues: {
      defaultUserCredits: 100,
      lowCreditThreshold: 20,
      autoExpiryEnabled: true,
      expiryDays: 180,
      autoRefillEnabled: false
    }
  })
  
  const watchExpiry = watch('autoExpiryEnabled')

  return (
    <FormShell 
      title="Credit Configuration" 
      description="Set rules and thresholds for the virtual lab compute economy."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <div className="grid gap-6">
        
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Allocation Rules</CardTitle>
            <CardDescription>Configure how credits are automatically assigned.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Default User Credits</Label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-10" {...register('defaultUserCredits')} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Base amount granted to new student accounts upon creation.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Low Credit Warning Threshold (%)</Label>
                <Input type="number" max={100} min={1} {...register('lowCreditThreshold')} />
                <p className="text-xs text-muted-foreground mt-1">Triggers UI warnings and email alerts when pool drops below this percentage.</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  Auto-Refill Next Semester
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Label>
                <p className="text-sm text-muted-foreground">Automatically top-up student accounts at the start of a new semester.</p>
              </div>
              <Switch 
                checked={watch('autoRefillEnabled')} 
                onCheckedChange={(val) => setValue('autoRefillEnabled', val, { shouldDirty: true })} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Expiry Rules</CardTitle>
            <CardDescription>Manage how unused credits expire over time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Auto-Expiry</Label>
                <p className="text-sm text-muted-foreground">Unused credits will expire after a set duration.</p>
              </div>
              <Switch 
                checked={watchExpiry} 
                onCheckedChange={(val) => setValue('autoExpiryEnabled', val, { shouldDirty: true })} 
              />
            </div>
            
            <div className={`space-y-2 ${!watchExpiry && 'opacity-50 pointer-events-none'}`}>
              <Label>Expiry Duration (Days)</Label>
              <Input type="number" {...register('expiryDays')} />
              <p className="text-xs text-muted-foreground mt-1">Number of days after allocation before credits are voided.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </FormShell>
  )
}
