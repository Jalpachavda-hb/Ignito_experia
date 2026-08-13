import { useState } from 'react'
import { KeyRound, ShieldCheck, ArrowRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { apiRequest } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/auth-store'

interface PasswordSetupModalProps {
  isOpen: boolean
  onClose: () => void
  tenantDomain?: string
}

export function PasswordSetupModal({ isOpen, onClose, tenantDomain }: PasswordSetupModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { auth } = useAuthStore()

  if (!isOpen) return null

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword || newPassword.length < 7) {
      toast.error('Password must be at least 7 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiRequest('/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword, confirmPassword }),
      })

      if (res.success) {
        toast.success(res.message || 'Password set successfully!')
        if (auth.user) {
          auth.setUser({
            ...auth.user,
            hasPassword: true,
            authType: 'LMS_AND_DIRECT',
          })
        }
        onClose()
      } else {
        toast.error(res.message || 'Failed to set password.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 border border-primary/20 text-primary rounded-2xl">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Secure Your Experia Account</h3>
            <p className="text-xs text-slate-500 font-medium">Experia Direct Password Setup</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed font-medium">
          You are currently accessing Experia through your university LMS. Set an Experia password so you can access your account directly from{' '}
          <span className="font-bold text-slate-900">{tenantDomain || 'your university portal'}</span> even if LMS access is offline.
        </p>

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">New Experia Password</label>
            <PasswordInput
              placeholder="At least 7 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Confirm Experia Password</label>
            <PasswordInput
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button type="submit" className="w-full sm:flex-1 gap-2" disabled={isSubmitting}>
              <KeyRound className="h-4 w-4" />
              {isSubmitting ? 'Setting Password...' : 'Set Password'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
              onClick={onClose}
            >
              Skip for Now
            </Button>
          </div>
        </form>

        <p className="text-center text-[11px] text-slate-400 font-medium">
          Your university LMS authentication will continue working as normal.
        </p>
      </div>
    </div>
  )
}
