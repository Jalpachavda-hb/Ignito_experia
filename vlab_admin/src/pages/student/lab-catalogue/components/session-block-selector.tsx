import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Database, Plus, Minus, CreditCard, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Lab } from '../../my-labs/types';

interface SessionBlockSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  lab: Lab | null;
  walletBalance: number;
  onStart: (labId: string, sessionBlocks: number) => Promise<void>;
  onPurchaseCredits?: () => void;
}

export function SessionBlockSelector({
  isOpen,
  onClose,
  lab,
  walletBalance,
  onStart,
  onPurchaseCredits
}: SessionBlockSelectorProps) {
  const [blocks, setBlocks] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!lab) return null;

  const labId = lab.id || lab.labId || lab.LabId || lab.labCode || lab.LabCode || lab._id || '';
  const labTitle = lab.title || lab.name || 'Virtual Lab';
  const unitCredits = Number(lab.creditCost || lab.credits || 100);
  const unitDuration = Number(lab.durationMinutes || lab.duration || 60);

  const totalCredits = unitCredits * blocks;
  const totalDuration = unitDuration * blocks;

  const isSufficient = walletBalance >= totalCredits;
  const shortage = Math.max(0, totalCredits - walletBalance);

  const handleStart = async () => {
    if (!isSufficient) return;
    setIsSubmitting(true);
    try {
      await onStart(labId, blocks);
      onClose();
    } catch (err) {
      console.error("Start session failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] rounded-[24px] p-6 bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge className="bg-red-50 text-red-600 border-red-200 font-bold px-2.5 py-0.5 text-[11px]">
              Session Allocation
            </Badge>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              <CreditCard className="w-3.5 h-3.5 text-red-500" />
              <span>Wallet: <strong>{walletBalance} Cr</strong></span>
            </div>
          </div>
          <DialogTitle className="text-xl font-extrabold text-slate-900 leading-snug">
            {labTitle}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500">
            Select the number of lab session blocks to allocate for this task.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-5">
          {/* Base Rate Info */}
          <div className="flex items-center justify-between text-[12px] font-medium text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" /> Base Block: {unitDuration} Minutes
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Database className="w-4 h-4 text-red-500" /> {unitCredits} Credits / Block
            </span>
          </div>

          {/* Block Selector */}
          <div className="space-y-3">
            <label className="text-[13px] font-bold text-slate-800">Select Lab Session Blocks:</label>
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <Button
                variant="outline"
                size="icon"
                disabled={blocks <= 1}
                onClick={() => setBlocks(prev => Math.max(1, prev - 1))}
                className="h-10 w-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                <Minus className="w-4 h-4" />
              </Button>

              <div className="text-center">
                <span className="text-lg font-black text-slate-900 block">{blocks} Session Block{blocks > 1 ? 's' : ''}</span>
                <span className="text-[12px] font-medium text-slate-500">{totalDuration} Minutes Total Access</span>
              </div>

              <Button
                variant="outline"
                size="icon"
                disabled={blocks >= 4}
                onClick={() => setBlocks(prev => Math.min(4, prev + 1))}
                className="h-10 w-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Block Options Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBlocks(b)}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  blocks === b
                    ? 'border-red-500 bg-red-50 text-red-600 font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                }`}
              >
                <div className="text-[12px] font-extrabold">{b} Block{b > 1 ? 's' : ''}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{unitCredits * b} Cr</div>
              </button>
            ))}
          </div>

          {/* Cost Summary Box */}
          <div className={`p-4 rounded-2xl border ${isSufficient ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-bold text-slate-800">Total Payment Required:</span>
              <span className="text-base font-black text-slate-900">{totalCredits} Credits</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-600">Wallet Status:</span>
              {isSufficient ? (
                <span className="flex items-center gap-1 font-bold text-emerald-600">
                  <ShieldCheck className="w-4 h-4" /> Sufficient Credits
                </span>
              ) : (
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <AlertTriangle className="w-4 h-4" /> Need {shortage} More Credits
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-[13px]"
          >
            Cancel
          </Button>

          {isSufficient ? (
            <Button
              disabled={isSubmitting}
              onClick={handleStart}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white text-[13px] px-6 h-10 shadow-md transition-all"
            >
              {isSubmitting ? 'Starting Lab...' : `Start Lab (${totalCredits} Cr)`}
            </Button>
          ) : (
            <Button
              onClick={() => { onClose(); onPurchaseCredits?.(); }}
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-[13px] px-6 h-10 shadow-md transition-all flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" /> Purchase Credits
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
