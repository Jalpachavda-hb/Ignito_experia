import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, CreditCard } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

interface PurchaseCreditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lab: any;
  userCredits: number;
  onPurchase?: () => void;
}

export function PurchaseCreditModal({
  open,
  onOpenChange,
  lab,
  userCredits,
  onPurchase,
}: PurchaseCreditModalProps) {
  const navigate = useNavigate();
  if (!lab) return null;

  const labCost = Number(lab.credits || lab.creditCost || 30);
  const currentBal = Math.max(0, Math.round(Number(userCredits || 0)));

  const handleBuyCredits = () => {
    onOpenChange(false);
    if (onPurchase) {
      onPurchase();
    } else {
      navigate({ to: '/student/credit-wallet' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white dark:bg-slate-900 border-0 shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-3 pb-2">
          <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-200/60 shadow-sm">
            <Coins className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            Purchase Credits Required
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center">
            You need credits to use this lab environment. Please purchase credits first to launch the lab and perform your tasks.
          </DialogDescription>
        </DialogHeader>

        {/* Lab & Credit Summary */}
        <div className="my-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-medium">Selected Lab</span>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={lab.title || lab.name}>
              {lab.title || lab.name || 'Virtual Lab'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-medium">Required Credits</span>
            <span className="font-bold text-red-600 dark:text-red-400">{labCost} Credits</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-medium">Your Wallet Balance</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">{currentBal} Credits</span>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-1/2 border-slate-300 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleBuyCredits}
            className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md shadow-red-500/20"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Buy Credits Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
