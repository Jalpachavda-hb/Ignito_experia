import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Save, RefreshCcw, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useEffect, useState, useRef } from 'react'
import { fetchAuthMe } from '@/Utils/GetApiHandler'
import { updateUserProfile, uploadProfilePhoto } from '@/Utils/PostApiHandler'

interface ProfileFormData {
  fullName: string
  email: string
  mobile: string
  designation: string
  organization: string
}

export function ProfileSettings() {
  const { auth: { user, updateUser } } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profileImage, setProfileImage] = useState<string>(user?.profileImage || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getCleanMobile = (m?: string) => {
    if (!m || m === '+91 98765 43210' || m === '+1 (555) 000-0000') return ''
    return m
  }

  const initialMobile = getCleanMobile(user?.mobile || user?.phoneNumber)

  const { register, handleSubmit, formState: { isDirty }, reset } = useForm<ProfileFormData>({
    defaultValues: {
      fullName: user?.fullName || '',
      email: user?.email || '',
      mobile: initialMobile,
      designation: user?.role || 'TENANT_ADMIN',
      organization: user?.organization || user?.tenantName || 'Acme University',
    }
  })

  // Load real profile from DB via /auth/me on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetchAuthMe()
        if (res?.success && res.user) {
          const u = res.user
          const newMobile = getCleanMobile(u.mobile || u.phoneNumber || user?.mobile || user?.phoneNumber)
          const newOrg = u.organization || u.tenantName || user?.organization || user?.tenantName || 'Acme University'
          const newImg = u.profileImage || user?.profileImage || ''

          setProfileImage(newImg)
          reset({
            fullName: u.fullName || u.name || user?.fullName || '',
            email: u.email || user?.email || '',
            mobile: newMobile,
            designation: u.role || user?.role || 'TENANT_ADMIN',
            organization: newOrg,
          })

          updateUser({
            fullName: u.fullName || u.name,
            email: u.email,
            mobile: newMobile,
            phoneNumber: newMobile,
            organization: newOrg,
            profileImage: newImg,
          })
        }
      } catch (err) {
        console.error('Error fetching profile from database:', err)
      }
    }
    loadProfile()
  }, [])

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const res = await uploadProfilePhoto(formData)
      const imageUrl = res?.url || res?.fileUrl || res?.profileImage
      if (res?.success && imageUrl) {
        setProfileImage(imageUrl)
        updateUser({ profileImage: imageUrl })
        toast.success('Profile photo uploaded and saved successfully!')
      } else {
        toast.error(res?.message || 'Failed to upload photo')
      }
    } catch (err: any) {
      console.error('Error uploading profile photo:', err)
      toast.error(err.message || 'Error uploading profile photo')
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setSaving(true)
      const res = await updateUserProfile({
        fullName: data.fullName,
        mobile: data.mobile,
        phoneNumber: data.mobile,
        organization: data.organization,
        profileImage,
      })

      if (res?.success) {
        const updatedUser = res.user || {}
        const newMobile = updatedUser.mobile || data.mobile
        const newOrg = updatedUser.organization || data.organization

        reset({
          fullName: data.fullName,
          email: data.email,
          mobile: newMobile,
          designation: data.designation,
          organization: newOrg,
        })

        updateUser({
          fullName: data.fullName,
          mobile: newMobile,
          phoneNumber: newMobile,
          organization: newOrg,
          profileImage,
        })

        toast.success('Profile updated successfully in database.')
      } else {
        toast.error(res?.message || 'Failed to update profile')
      }
    } catch (err: any) {
      console.error('Error updating profile:', err)
      toast.error(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Profile Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your public profile and contact information.</p>
      </div>

      <Card className="border-border/50 shadow-sm flex-1">
        <CardContent className="p-8 space-y-8">

          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 pb-8 border-b border-border/50">
            <div
              onClick={handlePhotoClick}
              className="h-32 w-32 shrink-0 border-2 border-primary/20 rounded-xl overflow-hidden bg-muted flex items-center justify-center relative group cursor-pointer"
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
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
                Upload a professional headshot. Recommended size is 256x256px. Max size 5MB.
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
              <Input {...register('fullName')} disabled={saving} />
            </div>

            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" {...register('email')} disabled={true} className="bg-muted/50 cursor-not-allowed" />
            </div>

            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input type="tel" {...register('mobile')} disabled={saving} placeholder="+91 98765 43210" />
            </div>

            <div className="space-y-2">
              <Label>Designation</Label>
              <Input {...register('designation')} disabled={saving} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Organization Name</Label>
              <Input {...register('organization')} disabled={saving} />
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
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="submit" disabled={!isDirty || saving}>
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
  )
}
