import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Send, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'

export function SmtpSettings() {
  const [showPassword, setShowPassword] = useState(false)
  const { register, formState: { isDirty }, reset } = useForm({
    defaultValues: {
      host: 'smtp.sendgrid.net',
      port: 587,
      username: 'apikey',
      password: 'sg.xxxxxxxxxxxxxxxxxxxxxxxxxx',
      senderEmail: 'noreply@vlab.enterprise',
    }
  })

  const handleTestEmail = async () => {
    toast.promise(sleep(1500), {
      loading: 'Sending test email...',
      success: 'Test email delivered successfully!',
      error: 'Failed to connect to SMTP server',
    })
  }

  return (
    <FormShell 
      title="SMTP Configuration" 
      description="Configure your mail server for sending outbound platform notifications."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6 space-y-6">
          
          <div className="flex items-center gap-4 p-4 border border-primary/20 bg-primary/5 rounded-lg mb-6">
            <MailCheck className="h-6 w-6 text-primary" />
            <div>
              <h4 className="font-medium text-sm">SMTP Status: Connected</h4>
              <p className="text-xs text-muted-foreground">Last successful connection was 2 minutes ago.</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={handleTestEmail}>
              <Send className="mr-2 h-4 w-4" />
              Send Test Email
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label>SMTP Host</Label>
              <Input {...register('host')} />
            </div>
            
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input type="number" {...register('port')} />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label>SMTP Username</Label>
              <Input {...register('username')} />
            </div>
            
            <div className="space-y-2 md:col-span-2 relative">
              <Label>SMTP Password / API Key</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} {...register('password')} />
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
            </div>

            <div className="space-y-2 md:col-span-2 pt-4 border-t border-border/50">
              <Label>Default Sender Email</Label>
              <Input type="email" {...register('senderEmail')} />
              <p className="text-xs text-muted-foreground mt-1">The "From" address used for outgoing platform alerts.</p>
            </div>
          </div>

        </CardContent>
      </Card>
    </FormShell>
  )
}
