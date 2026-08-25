import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Database, Plus, Minus, CreditCard, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useLabSessionStore } from '@/stores/labSessionStore';
import { useLabStore } from '@/stores/labStore';

interface ExtendSessionModalProps {
  walletBalance: number;
  onPurchaseCredits?: () => void;
}

export function ExtendSessionModal({ walletBalance, onPurchaseCredits }: ExtendSessionModalProps) {
  const {
    showExtensionModal,
    setShowExtensionModal,
    activeSession,
    extendLab,
    extendingSessionId,
    extendError
  } = useLabSessionStore();

  const labs = useLabStore((state: any) => state.labs) || [];
  const [blocks, setBlocks] = useState<number>(1);

  if (!showExtensionModal || !activeSession) return null;

  const matchedLab = labs.find((l: any) => (l.id || l.labId || l.LabId || l.labCode || l._id) === activeSession.labId);
  const unitCredits = Number(matchedLab?.creditCost || matchedLab?.credits || 100);
  const unitDuration = Number(matchedLab?.durationMinutes || matchedLab?.duration || 60);

  const totalCredits = unitCredits * blocks;
  const totalDuration = unitDuration * blocks;

  const isSufficient = walletBalance >= totalCredits;
  const shortage = Math.max(0, totalCredits - walletBalance);

  const handleExtend = async () => {
    if (!isSufficient) return;
    const success = await extendLab(blocks);
    if (success) {
      setShowExtensionModal(false);
    }
  };

  return (
    <Dialog open={showExtensionModal} onOpenChange={(open) => !open && setShowExtensionModal(false)}>
      <DialogContent className="sm:max-w-[480px] rounded-[24px] p-6 bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge className="bg-red-50 text-red-600 border-red-200 font-bold px-2.5 py-0.5 text-[11px]">
              Extend Lab Session
            </Badge>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              <CreditCard className="w-3.5 h-3.5 text-red-500" />
              <span>Wallet: <strong>{walletBalance} Cr</strong></span>
            </div>
          </div>
          <DialogTitle className="text-xl font-extrabold text-slate-900 leading-snug">
            Extend Your Session
          </DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500">
            Add additional session blocks to continue working without interruption.
          </DialogDescription>
        </DialogHeader>

        {extendError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[12px] font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{extendError}</span>
          </div>
        )}

        <div className="my-3 space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-slate-800">Select Extension Duration:</label>
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
                <span className="text-lg font-black text-slate-900 block">+{totalDuration} Minutes</span>
                <span className="text-[12px] font-semibold text-red-600">{totalCredits} Credits</span>
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

          {/* Quick Choice Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(b => (
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
                <div className="text-[12px] font-extrabold">+{unitDuration * b} Mins</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{unitCredits * b} Credits</div>
              </button>
            ))}
          </div>

          <div className={`p-3.5 rounded-2xl border ${isSufficient ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-600 font-medium">Extension Cost:</span>
              <span className="font-extrabold text-slate-900">{totalCredits} Credits</span>
            </div>
            <div className="flex items-center justify-between text-[12px] mt-1">
              <span className="text-slate-600 font-medium">Wallet Status:</span>
              {isSufficient ? (
                <span className="flex items-center gap-1 font-bold text-emerald-600">
                  <ShieldCheck className="w-3.5 h-3.5" /> Sufficient Credits
                </span>
              ) : (
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> Shortage: {shortage} Credits
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="ghost"
            onClick={() => setShowExtensionModal(false)}
            className="rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-[13px]"
          >
            Cancel
          </Button>

          {isSufficient ? (
            <Button
              disabled={Boolean(extendingSessionId)}
              onClick={handleExtend}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white text-[13px] px-6 h-10 shadow-md transition-all"
            >
              {extendingSessionId ? 'Extending...' : `Confirm Extension (${totalCredits} Cr)`}
            </Button>
          ) : (
            <Button
              onClick={() => { setShowExtensionModal(false); onPurchaseCredits?.(); }}
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
