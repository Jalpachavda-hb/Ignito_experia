import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { IconFacebook, IconGithub } from '@/assets/brand-icons'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { getTenantSlug } from '@/lib/tenant-slug'
import { loginWithCredentials } from '@/services/authService'
import { loadStudentPortalData, mergeStudentPortalUser } from '@/Utils/lmsApi_paths'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email.' : undefined),
  }),
  password: z
    .string()
    .min(1, 'Please enter your password.')
    .min(7, 'Password must be at least 7 characters long.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    const slug = getTenantSlug()

    toast.promise(
      loginWithCredentials({
        email: data.email,
        password: data.password,
        slug,
        portalHost: window.location.host,
      }),
      {
        loading: 'Signing in...',
        success: async (response: any) => {
          setIsLoading(false)

          const token = response?.accessToken || response?.token
          auth.setAccessToken(token)
          if (response?.refreshToken) {
            auth.setRefreshToken?.(response.refreshToken)
          }

          let finalUser = response?.user || {}

          try {
            const { fetchAuthMe } = await import('@/Utils/GetApiHandler')
            const meData: any = await fetchAuthMe()
            if (meData?.user) {
              finalUser = { ...finalUser, ...meData.user }
            }
          } catch (err) {
            console.warn("Direct login profile fetch warning:", err)
          }

          try {
            const studentId = finalUser.studentId || finalUser.studentDegreeAdmissionId || finalUser.externalStudentId
            const portal = await loadStudentPortalData(studentId)
            finalUser = mergeStudentPortalUser(finalUser, portal)
          } catch (err) {
            console.warn("Direct login LMS data warning:", err)
          }

          const user = {
            ...finalUser,
            userId: finalUser.id || finalUser.userId,
            fullName: finalUser.fullName || finalUser.name || 'User',
            name: finalUser.fullName || finalUser.name || 'User',
            email: finalUser.email || data.email,
            role: finalUser.role || 'Student',
            status: finalUser.status || 'Active',
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
          }

          auth.setUser(user)

          let targetPath = redirectTo || '/'
          const isStudentRole = (user.role || '').toLowerCase() === 'student'
          if (isStudentRole && targetPath === '/') {
            targetPath = '/student/dashboard'
          }
          navigate({ to: targetPath, replace: true })

          return `Welcome back, ${user.fullName || user.email}!`
        },
        error: (err) => {
          setIsLoading(false)
          return err?.message || 'Login failed. Please check your credentials.'
        },
      }
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>

      </form>
    </Form>
  )
}
