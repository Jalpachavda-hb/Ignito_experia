import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, PlusCircle } from 'lucide-react';
import { useLabSessionStore } from '@/stores/labSessionStore';

export function TenMinuteWarningModal() {
  const {
    showWarningModal,
    setShowWarningModal,
    setWarningAcknowledged,
    setShowExtensionModal,
    remainingSeconds
  } = useLabSessionStore();

  if (!showWarningModal) return null;

  const minsLeft = Math.max(1, Math.floor((remainingSeconds || 600) / 60));

  const handleContinue = () => {
    setWarningAcknowledged(true);
    setShowWarningModal(false);
  };

  const handleOpenExtend = () => {
    setShowWarningModal(false);
    setShowExtensionModal(true);
  };

  return (
    <Dialog open={showWarningModal} onOpenChange={(open) => !open && handleContinue()}>
      <DialogContent className="sm:max-w-[440px] rounded-[24px] p-6 bg-white border border-amber-200 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-extrabold text-slate-900 leading-snug">
            Your lab session will expire in {minsLeft} minutes
          </DialogTitle>
          <DialogDescription className="text-[13px] text-slate-600 leading-relaxed">
            You have approximately <strong>{minsLeft} minutes</strong> of remaining lab access. Save your work and extend your session if you need additional time to complete your tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between text-[13px] font-semibold text-amber-900">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" /> Session Expiry Alert
          </span>
          <span className="font-extrabold text-amber-700 font-mono">00:09:59</span>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={handleContinue}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[13px] h-10 px-4"
          >
            Continue Working
          </Button>

          <Button
            onClick={handleOpenExtend}
            className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-[13px] h-10 px-5 shadow-md flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Extend Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
