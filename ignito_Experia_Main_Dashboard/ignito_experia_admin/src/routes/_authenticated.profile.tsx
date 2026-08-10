import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useEffect, useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Save, RefreshCw, User, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { apiRequest } from '@/services/api'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
})

interface ProfileFormData {
  fullName: string
  email: string
  mobile: string
  designation: string
  organization: string
  password?: string
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatarUrl || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, formState: { isDirty }, reset, handleSubmit, setValue } = useForm<ProfileFormData>({
    defaultValues: {
      fullName: user?.fullName || 'Platform Owner',
      email: user?.email || 'owner@ignito.com',
      mobile: user?.phoneNumber || '+91 98765 43210',
      designation: user?.designation || 'Platform Owner',
      organization: user?.organization || 'Ignito Experia Owner',
      password: '',
    }
  })

  // Fetch latest profile from DB on load
  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await apiRequest<{ success: boolean; profile: any }>('/admin/profile')
      if (res?.success && res.profile) {
        const p = res.profile
        const updatedData = {
          fullName: p.fullName || 'Platform Owner',
          email: p.email || 'owner@ignito.com',
          mobile: p.phoneNumber || '+91 98765 43210',
          designation: p.designation || 'Platform Owner',
          organization: p.organization || 'Ignito Experia Owner',
          password: '',
        }
        reset(updatedData)
        if (p.avatarUrl) setAvatarUrl(p.avatarUrl)
        updateUser({
          ownerId: p.ownerId,
          email: p.email,
          fullName: p.fullName,
          phoneNumber: p.phoneNumber,
          designation: p.designation,
          organization: p.organization,
          avatarUrl: p.avatarUrl,
        })
      }
    } catch (err: any) {
      console.error('Failed to fetch owner profile:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2MB limit.')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
      const token = useAuthStore.getState().accessToken

      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await res.json()
      if (data?.success && data.fileUrl) {
        setAvatarUrl(data.fileUrl)
        toast.success('Photo uploaded successfully! Save profile changes to apply.')
      } else {
        toast.error('Failed to upload image')
      }
    } catch (err: any) {
      toast.error('Upload error: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setSaving(true)
      const payload = {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.mobile,
        designation: data.designation,
        organization: data.organization,
        avatarUrl: avatarUrl,
        ...(data.password ? { password: data.password } : {}),
      }

      const res = await apiRequest<{ success: boolean; user: any; token?: string }>('/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      if (res?.success) {
        if (res.user) {
          updateUser(res.user)
        }
        reset({ ...data, password: '' })
        toast.success('Profile updated successfully in owner database.')
      } else {
        toast.error('Failed to update profile.')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
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
              
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handlePhotoUpload}
              />

              <div className="flex flex-col md:flex-row items-start md:items-center gap-8 pb-8 border-b border-border/50">
                <div
                  onClick={handlePhotoClick}
                  className="h-32 w-32 shrink-0 border-2 border-primary/20 rounded-xl overflow-hidden bg-muted flex items-center justify-center relative group cursor-pointer"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-16 w-16 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6 text-white" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Profile Photo</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Upload a professional headshot. Recommended size is 256x256px. Max size 2MB.
                  </p>
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePhotoClick}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {uploading ? 'Uploading...' : 'Upload New Photo'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input {...register('fullName')} disabled={loading} />
                </div>
                
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" {...register('email')} disabled={loading} />
                </div>
                
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input type="tel" {...register('mobile')} disabled={loading} />
                </div>
                
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input {...register('designation')} disabled={loading} />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label>Organization Name</Label>
                  <Input {...register('organization')} disabled={loading} />
                </div>

                <div className="space-y-2 md:col-span-2 border-t border-border/50 pt-6 mt-2">
                  <Label className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Lock className="h-4 w-4 text-primary" />
                    Change Password (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">Leave blank if you do not wish to change your current password.</p>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    {...register('password')}
                    disabled={loading}
                  />
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
                <Button type="button" variant="outline" onClick={() => reset()} disabled={!isDirty || saving}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button type="submit" disabled={(!isDirty && avatarUrl === (user?.avatarUrl || '')) || saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Main>
    </>
  )
}
