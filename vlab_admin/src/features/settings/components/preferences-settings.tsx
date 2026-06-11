import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Monitor, Moon, Sun } from 'lucide-react'

export function PreferencesSettings() {
  const { register, watch, formState: { isDirty }, reset, setValue } = useForm({
    defaultValues: {
      theme: 'system',
      language: 'en-US',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY'
    }
  })
  
  const selectedTheme = watch('theme')

  return (
    <FormShell 
      title="Account Preferences" 
      description="Customize your UI theme, language, and regional settings."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <div className="grid gap-6">
        
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Appearance</h3>
                <p className="text-sm text-muted-foreground">Select how you want the admin panel to look.</p>
              </div>
              
              <RadioGroup 
                defaultValue="system" 
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                onValueChange={(val) => setValue('theme', val, { shouldDirty: true })}
              >
                <Label
                  htmlFor="theme-light"
                  className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${selectedTheme === 'light' ? 'border-primary' : ''}`}
                >
                  <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                  <Sun className="mb-3 h-6 w-6" />
                  Light Mode
                </Label>
                
                <Label
                  htmlFor="theme-dark"
                  className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${selectedTheme === 'dark' ? 'border-primary' : ''}`}
                >
                  <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                  <Moon className="mb-3 h-6 w-6" />
                  Dark Mode
                </Label>
                
                <Label
                  htmlFor="theme-system"
                  className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${selectedTheme === 'system' ? 'border-primary' : ''}`}
                >
                  <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                  <Monitor className="mb-3 h-6 w-6" />
                  System Default
                </Label>
              </RadioGroup>
            </div>

            <div className="pt-6 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select defaultValue="en-US" onValueChange={(val) => setValue('language', val, { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-UK">English (UK)</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Time Zone</Label>
                <Select defaultValue="UTC" onValueChange={(val) => setValue('timezone', val, { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Time Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC (Universal Coordinated Time)</SelectItem>
                    <SelectItem value="EST">EST (Eastern Standard Time)</SelectItem>
                    <SelectItem value="PST">PST (Pacific Standard Time)</SelectItem>
                    <SelectItem value="IST">IST (Indian Standard Time)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select defaultValue="MM/DD/YYYY" onValueChange={(val) => setValue('dateFormat', val, { shouldDirty: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Date Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </FormShell>
  )
}
