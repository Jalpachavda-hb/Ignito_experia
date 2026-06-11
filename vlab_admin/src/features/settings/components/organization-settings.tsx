import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Upload, Building2 } from 'lucide-react'

export function OrganizationSettings() {
  const { register, watch, formState: { isDirty }, reset } = useForm({
    defaultValues: {
      name: 'Acme University',
      email: 'contact@acme.edu',
      phone: '+1 (800) 123-4567',
      address: '123 Academic Way, Tech District',
      website: 'https://acme.edu'
    }
  })

  return (
    <FormShell 
      title="Organization Settings" 
      description="Manage your institution's public profile and branding."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6 space-y-6">
          
          <div className="flex items-center gap-6 pb-6 border-b border-border/50">
            <Avatar className="h-24 w-24 border-2 border-primary/20 bg-muted">
              <AvatarImage src="" />
              <AvatarFallback><Building2 className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <h3 className="font-medium">Organization Logo</h3>
              <p className="text-sm text-muted-foreground">This logo will appear on the student dashboard and login screen. Max size 2MB.</p>
              <Button type="button" variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload Logo
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label>Organization Name</Label>
              <Input {...register('name')} />
            </div>
            
            <div className="space-y-2">
              <Label>Official Email Address</Label>
              <Input type="email" {...register('email')} />
            </div>
            
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input type="tel" {...register('phone')} />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label>Physical Address</Label>
              <Input {...register('address')} />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label>Website URL</Label>
              <Input type="url" {...register('website')} />
            </div>
          </div>

        </CardContent>
      </Card>
    </FormShell>
  )
}
