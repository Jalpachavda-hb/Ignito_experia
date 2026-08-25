import { useState, useRef } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MailCheck, EyeOff, Eye, Camera, Upload, X, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { sleep, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { registerWithCredentials } from '@/services/authService'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,

} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'


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
  agreeTerms: z.boolean().optional().default(true),
  receiveUpdates: z.boolean().optional().default(false),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

type SignUpFormInput = z.input<typeof formSchema>
type SignUpFormOutput = z.output<typeof formSchema>

export function SignUpForm({
  className,
  redirectTo,
  ...props
}: React.HTMLAttributes<HTMLFormElement> & { redirectTo?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<SignUpFormInput, any, SignUpFormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      mobileNumber: '',
      password: '',
      confirmPassword: '',
      agreeTerms: true,
      receiveUpdates: false,
    },
  })

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be less than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function onSubmit(data: SignUpFormOutput) {
    setIsLoading(true)

    try {
      await registerWithCredentials({
        fullName: data.fullName,
        email: data.email,
        mobileNumber: data.mobileNumber,
        password: data.password,
        confirmPassword: data.confirmPassword,
        profileImage: photoPreview || undefined,
      });

      setIsLoading(false)
      setIsSuccess(true)
      toast.success('Account created successfully!')
    } catch (err: any) {
      setIsLoading(false)
      toast.error(err.message || 'Registration failed. Please try again.')
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
          <MailCheck className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-slate-900">Account Created Successfully!</h3>
          <p className="text-slate-500 font-medium max-w-[300px]">
            Your student account is ready. You can log in immediately — no extra steps needed.
          </p>
        </div>
        <div className="w-full pt-4">
          <Button className="w-full bg-[#dc2626] hover:bg-[#dc2626]/90 text-white" onClick={() => window.location.href = '/sign-in'}>
            Go To Login
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
        {/* Profile Photo Field */}
        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="relative group shrink-0">
            <Avatar className="h-16 w-16 border-2 border-red-500/20 shadow-sm bg-white dark:bg-slate-800">
              {photoPreview ? (
                <AvatarImage src={photoPreview} alt="Profile Photo" className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
                <UserIcon className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Profile Photo</span>
              <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
            </p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {photoPreview ? 'Photo selected' : 'Upload a profile photo for your student account'}
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5 bg-white dark:bg-slate-800 border-slate-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3 mr-1 text-slate-500" />
                {photoPreview ? 'Change Photo' : 'Upload Photo'}
              </Button>
              
              {photoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={handleRemovePhoto}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

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
        {/* {watchPassword && (
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
        )} */}

        {/* <div className="space-y-2 pt-1">
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
        </div> */}

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
