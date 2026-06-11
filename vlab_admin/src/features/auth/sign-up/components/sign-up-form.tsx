import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MailCheck, CheckCircle2, EyeOff, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { sleep, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

const formSchema = z.object({
  fullName: z.string().min(1, 'Full Name is required'),
  email: z.string().email('Invalid email address'),
  mobileNumber: z.string().min(10, 'Mobile Number must be at least 10 digits'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string(),
  
  // Terms
  agreeTerms: z.boolean().refine(val => val === true, 'You must agree to the Terms & Conditions and Privacy Policy'),
  receiveUpdates: z.boolean().optional().default(false),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

export function SignUpForm({
  className,
  redirectTo,
  ...props
}: React.HTMLAttributes<HTMLFormElement> & { redirectTo?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      mobileNumber: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
      receiveUpdates: false,
    },
  })

  const watchPassword = form.watch('password') || ''

  const passwordReqs = [
    { regex: /[A-Z]/, label: 'Uppercase' },
    { regex: /[a-z]/, label: 'Lowercase' },
    { regex: /[0-9]/, label: 'Number' },
    { regex: /[^A-Za-z0-9]/, label: 'Special' },
    { regex: /.{8,}/, label: '8+ Chars' },
  ]

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    
    // Auto-assign student role
    const payload = {
      ...data,
      role: 'student'
    }

    // Simulate API call
    await sleep(1500)
    
    setIsLoading(false)
    setIsSuccess(true)
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
          <MailCheck className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-slate-900">Account Created Successfully</h3>
          <p className="text-slate-500 font-medium max-w-[300px]">
            Please verify your email before logging in. We've sent a verification link to your email address.
          </p>
        </div>
        <div className="w-full space-y-3 pt-4">
          <Button className="w-full bg-[#dc2626] hover:bg-[#dc2626]/90 text-white" onClick={() => window.location.href = '/sign-in'}>
            Go To Login
          </Button>
          <Button variant="outline" className="w-full" onClick={() => toast.success('Verification email sent!')}>
            Resend Verification Email
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3 relative', className)}
        {...props}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="john@example.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="mobileNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile Number <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="+1 (555) 000-0000" type="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input placeholder="********" type={showPassword ? 'text' : 'password'} {...field} />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-0 top-0 h-full px-3 py-1 hover:bg-transparent text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input placeholder="********" type={showConfirmPassword ? 'text' : 'password'} {...field} />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-0 top-0 h-full px-3 py-1 hover:bg-transparent text-slate-400 hover:text-slate-600"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Password Strength Meter - Horizontal layout */}
        {watchPassword && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
            {passwordReqs.map((req, i) => (
              <div key={i} className="flex items-center gap-1">
                {req.regex.test(watchPassword) ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-slate-300 shrink-0" />
                )}
                <span className={req.regex.test(watchPassword) ? "text-slate-700" : "text-slate-400"}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-1">
          <FormField
            control={form.control}
            name="agreeTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5 data-[state=checked]:bg-[#dc2626] data-[state=checked]:border-[#dc2626]" />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-[13px] font-medium text-slate-700">
                    I agree to the Terms & Conditions and Privacy Policy.
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="receiveUpdates"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5 data-[state=checked]:bg-[#dc2626] data-[state=checked]:border-[#dc2626]" />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-[13px] font-medium text-slate-700">
                    Receive platform updates.
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        {/* Sticky Action Area */}
        <div className="sticky bottom-0 bg-white pt-4 pb-2 mt-2 border-t border-slate-100 flex flex-col gap-3">
          <Button className="w-full bg-[#dc2626] hover:bg-[#dc2626]/90 text-white h-11 text-base font-semibold shadow-md shadow-red-500/20" disabled={isLoading || isSuccess}>
            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Create Account
          </Button>
          <div className="text-center text-sm text-slate-500 font-medium">
            Already have an account?{' '}
            <Link to="/sign-in" className="font-bold text-[#dc2626] hover:text-[#dc2626]/80 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </form>
    </Form>
  )
}
