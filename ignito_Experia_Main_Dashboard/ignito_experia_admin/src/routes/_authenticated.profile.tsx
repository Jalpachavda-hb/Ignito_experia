import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Save, RefreshCw, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
})

export default function ProfilePage() {
  const { user } = useAuthStore()

  const { register, formState: { isDirty }, reset, handleSubmit } = useForm({
    defaultValues: {
      fullName: user?.fullName || 'Platform Owner',
      email: user?.email || 'owner@ignito.com',
      mobile: '+91 98765 43210',
      designation: 'Platform Owner',
      organization: 'Ignito Experia Owner',
    }
  })

  useEffect(() => {
    if (user) {
      reset({
        fullName: user.fullName || 'Platform Owner',
        email: user.email || 'owner@ignito.com',
        mobile: '+91 98765 43210',
        designation: 'Platform Owner',
        organization: 'Ignito Experia Owner',
      })
    }
  }, [user, reset])

  const onSubmit = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: 'Saving configuration...',
        success: 'Profile updated successfully.',
        error: 'Failed to update settings',
      }
    )
  }

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Profile Settings</h2>
            <p className="text-muted-foreground mt-1">Manage your public profile and contact information.</p>
          </div>

          <Card className="border-border/50 shadow-sm w-full">
            <CardContent className="p-8 space-y-8">
              
              <div className="flex flex-col md:flex-row items-start md:items-center gap-8 pb-8 border-b border-border/50">
                <div className="h-32 w-32 shrink-0 border-2 border-primary/20 rounded-xl overflow-hidden bg-muted flex items-center justify-center relative group">
                  <User className="h-16 w-16 text-muted-foreground" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Upload className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Profile Photo</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Upload a professional headshot. Recommended size is 256x256px. Max size 2MB.
                  </p>
                  <div className="pt-2">
                    <Button type="button" variant="outline" size="sm">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload New Photo
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input {...register('fullName')} />
                </div>
                
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" {...register('email')} />
                </div>
                
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input type="tel" {...register('mobile')} />
                </div>
                
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input {...register('designation')} />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label>Organization Name</Label>
                  <Input {...register('organization')} />
                </div>
              </div>

            </CardContent>
            <CardFooter className="px-8 py-6 bg-muted/5 border-t border-border/50 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isDirty ? (
                  <span className="text-amber-500 font-medium">Unsaved changes</span>
                ) : (
                  'All changes saved'
                )}
              </div>
              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => reset()} disabled={!isDirty}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button type="submit" disabled={!isDirty}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Main>
    </>
  )
}
