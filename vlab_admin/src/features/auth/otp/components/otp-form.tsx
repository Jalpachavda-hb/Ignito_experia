import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { resetPassword } from '@/Utils/PostApiHandler'
import { PasswordInput } from '@/components/password-input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'

const formSchema = z.object({
  otp: z
    .string()
    .min(6, 'Please enter the 6-digit code.')
    .max(6, 'Please enter the 6-digit code.'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters.'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type OtpFormProps = React.HTMLAttributes<HTMLFormElement>

export function OtpForm({ className, ...props }: OtpFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '', newPassword: '', confirmPassword: '' },
  })

  // eslint-disable-next-library
  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof formSchema>) {
    const email = sessionStorage.getItem('resetEmail')
    if (!email) {
      toast.error('Session expired. Please request password reset again.')
      navigate({ to: '/forgot-password' })
      return
    }

    try {
      setIsLoading(true)
      const res: any = await resetPassword({
        email,
        otp: data.otp,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      })
      setIsLoading(false)
      if (res?.success) {
        toast.success(res.message || 'Password reset successfully! Please sign in.')
        sessionStorage.removeItem('resetEmail')
        navigate({ to: '/sign-in' })
      } else {
        toast.error(res?.message || 'Failed to reset password')
      }
    } catch (err: any) {
      setIsLoading(false)
      toast.error(err?.message || 'Error resetting password')
    }
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
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel>6-Digit OTP Code</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='newPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='Enter new password' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='Re-enter new password' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className='mt-2' disabled={otp.length < 6 || isLoading}>
          Reset Password
        </Button>

        <div className="text-center text-xs text-muted-foreground pt-2">
          Haven't received it?{' '}
          <button
            type="button"
            onClick={async () => {
              const email = sessionStorage.getItem('resetEmail')
              if (!email) {
                toast.error('Session expired. Please request password reset again.')
                navigate({ to: '/forgot-password' })
                return
              }
              try {
                const { forgotPassword } = await import('@/Utils/PostApiHandler')
                const res: any = await forgotPassword({ email })
                if (res?.success) {
                  toast.success(res.message || 'New OTP code sent!')
                } else {
                  toast.error(res?.message || 'Failed to resend OTP code')
                }
              } catch (err: any) {
                toast.error(err?.message || 'Error resending OTP code')
              }
            }}
            className="font-semibold text-red-600 hover:underline"
          >
            Resend a new code
          </button>
        </div>
      </form>
    </Form>
  )
}
