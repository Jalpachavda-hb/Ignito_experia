import { AlertTriangle, ShieldAlert, KeyRound, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CreditPasswordWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onSetPassword: () => void
  onProceedPurchase: () => void
}

export function CreditPasswordWarningModal({
  isOpen,
  onClose,
  onSetPassword,
  onProceedPurchase,
}: CreditPasswordWarningModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-white border border-amber-200/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Secure Your Experia Credits</h3>
            <p className="text-xs text-amber-600 font-semibold">Important Account Security Notice</p>
          </div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
            <AlertTriangle className="h-4 w-4" />
            LMS Access Dependency Warning
          </div>
          <p className="text-xs text-amber-700 leading-relaxed font-medium">
            You are accessing Experia through your university LMS without an Experia password. If your university LMS access ends after your academic program completes, you may no longer be able to log in through LMS.
          </p>
          <p className="text-xs text-amber-900 font-semibold pt-1">
            Your purchased credits will remain safely stored in your account (`EXP10001`), but setting an Experia password guarantees direct access at any time.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            onClick={() => {
              onClose()
              onSetPassword()
            }}
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            <KeyRound className="h-4 w-4" />
            Set Password Now (Recommended)
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose()
              onProceedPurchase()
            }}
            className="w-full text-slate-600 hover:text-slate-900"
          >
            Continue Without Password
          </Button>
        </div>
      </div>
    </div>
  )
}
