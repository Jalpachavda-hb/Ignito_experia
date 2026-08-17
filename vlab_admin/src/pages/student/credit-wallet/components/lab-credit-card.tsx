import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MonitorPlay, Ticket, CheckCircle2, Loader2, CreditCard, Sparkles } from 'lucide-react';
import { Lab } from '../../my-labs/types';
import { PaymentGateway } from '../../my-labs/components/payment-gateway';
import { initiateRazorpayPayment } from '@/Utils/razorpayHandler';

export interface LabCreditInfo {
  allocated: number;
  used: number;
  remaining: number;
}

interface LabCreditCardProps {
  lab: Lab;
  creditInfo: LabCreditInfo;
  onTopUp: (labId: string, amount: number) => void;
  onApplyCoupon: (labId: string, code: string) => void;
  view?: 'grid' | 'list';
}

// Mild, soft filled color themes
const colorThemes = [
  {
    name: 'indigo',
    iconBg: 'bg-indigo-100/60 dark:bg-indigo-950/40 border border-indigo-200/50 text-indigo-700 dark:text-indigo-300',
    amountText: 'text-indigo-700 dark:text-indigo-300',
    sparkle: 'text-indigo-400',
    btnBg: 'bg-indigo-100/80 hover:bg-indigo-200/80 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200/60 font-bold shadow-2xs',
    pill50: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/40',
    pill100: 'bg-slate-100/70 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800',
  },
  {
    name: 'blue',
    iconBg: 'bg-sky-100/60 dark:bg-sky-950/40 border border-sky-200/50 text-sky-700 dark:text-sky-300',
    amountText: 'text-sky-700 dark:text-sky-300',
    sparkle: 'text-sky-400',
    btnBg: 'bg-sky-100/80 hover:bg-sky-200/80 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60 border border-sky-200/60 font-bold shadow-2xs',
    pill50: 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/60 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/40',
    pill100: 'bg-slate-100/70 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800',
  },
  {
    name: 'emerald',
    iconBg: 'bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200/50 text-emerald-700 dark:text-emerald-300',
    amountText: 'text-emerald-700 dark:text-emerald-300',
    sparkle: 'text-emerald-400',
    btnBg: 'bg-emerald-100/80 hover:bg-emerald-200/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200/60 font-bold shadow-2xs',
    pill50: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40',
    pill100: 'bg-slate-100/70 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800',
  },
  {
    name: 'violet',
    iconBg: 'bg-violet-100/60 dark:bg-violet-950/40 border border-violet-200/50 text-violet-700 dark:text-violet-300',
    amountText: 'text-violet-700 dark:text-violet-300',
    sparkle: 'text-violet-400',
    btnBg: 'bg-violet-100/80 hover:bg-violet-200/80 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:bg-violet-900/60 border border-violet-200/60 font-bold shadow-2xs',
    pill50: 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/40',
    pill100: 'bg-slate-100/70 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800',
  },
  {
    name: 'slate',
    iconBg: 'bg-slate-100 dark:bg-slate-800 border border-slate-200 text-slate-800 dark:text-slate-200',
    amountText: 'text-slate-800 dark:text-slate-200',
    sparkle: 'text-slate-400',
    btnBg: 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 border border-slate-200 font-bold shadow-2xs',
    pill50: 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-300',
    pill100: 'bg-slate-100/50 hover:bg-slate-200/50 text-slate-600 border border-slate-200 dark:bg-slate-900/50 dark:text-slate-400',
  },
];

const getTheme = (idOrName: string) => {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorThemes[Math.abs(hash) % colorThemes.length];
};

export function LabCreditCard({ lab, creditInfo, onTopUp, onApplyCoupon, view = 'grid' }: LabCreditCardProps) {
  const [addedAmountInput, setAddedAmountInput] = useState<number | string>(200);
  const [couponCode, setCouponCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const labId = lab.id || lab.labId || lab.name || 'lab';
  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const theme = getTheme(labId + name);
  
  const { remaining } = creditInfo;

  // Credit & Payment calculations
  const addedCredits = Math.max(0, Number(addedAmountInput) || 0);
  const availableCredit = remaining;
  const newTotalBalance = availableCredit + addedCredits;
  const pricePerCredit = 1; // ₹1 per credit
  const totalPaymentRupees = addedCredits * pricePerCredit;
  
  let statusText = 'Sufficient';
  let statusColor = 'bg-emerald-50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40';
  
  if (remaining === 0) {
    statusText = 'Exhausted';
    statusColor = 'bg-rose-50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40';
  } else if (remaining <= 20) {
    statusText = 'Low Credits';
    statusColor = 'bg-amber-50 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40';
  }

  const handleQuickAdd = (valueToAdd: number) => {
    const currentVal = Number(addedAmountInput) || 0;
    setAddedAmountInput(currentVal + valueToAdd);
  };

  const handlePayWithRazorpay = async () => {
    if (addedCredits <= 0) return;

    // Trigger real Razorpay Checkout modal
    const launched = await initiateRazorpayPayment({
      amountInRupees: totalPaymentRupees,
      labName: name,
      labId: lab.id,
      onSuccess: (paymentId) => {
        onTopUp(lab.id, addedCredits);
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3500);
      },
      onDismiss: () => {
        // Razorpay modal closed
      },
    });

    // Fallback if Razorpay SDK script popup is blocked or unavailable
    if (!launched) {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentCompleted = (labItem: any, amountPaid: number) => {
    onTopUp(lab.id, addedCredits);
    setShowPaymentModal(false);
    setUpdateSuccess(true);
    setTimeout(() => setUpdateSuccess(false), 3000);
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    setIsApplying(true);
    setTimeout(() => {
      setIsApplying(false);
      onApplyCoupon(lab.id, couponCode);
      setCouponSuccess('Applied!');
      setCouponCode('');
      setTimeout(() => setCouponSuccess(''), 3000);
    }, 800);
  };

  if (view === 'list') {
    return (
      <>
        <Card className="flex flex-col lg:flex-row bg-white dark:bg-card border border-border/60 rounded-xl shadow-xs hover:shadow-md transition-all duration-200 p-3.5 gap-4 items-center">
          {/* Left: Icon & Lab Name */}
          <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
            <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center p-1 shadow-2xs ${theme.iconBg}`}>
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
              ) : (
                <MonitorPlay className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground leading-snug truncate">
                {name}
              </h3>
            </div>
          </div>

          {/* Status Badge */}
          <Badge variant="outline" className={`px-2 py-0.5 text-[8px] font-bold tracking-wider rounded-full shrink-0 ${statusColor}`}>
            {statusText}
          </Badge>

          {/* Center: Available Credit vs Total After Top-Up */}
          <div className="flex items-center gap-3 bg-slate-50/60 dark:bg-slate-900/40 border border-border/40 rounded-xl px-3 py-1.5 shrink-0 text-xs font-semibold">
            <div>
              <span className="text-[9px] font-extrabold uppercase text-muted-foreground block">Available</span>
              <span className="font-black text-foreground">{availableCredit} Cr</span>
            </div>
            <div className="text-border">|</div>
            <div>
              <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 block">After Top-Up</span>
              <span className={`font-black ${theme.amountText}`}>{newTotalBalance} Cr</span>
            </div>
          </div>

          {/* Right: Editable Added Credit & Pay Bill Button */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto shrink-0">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Input 
                type="number" 
                min="1"
                placeholder="Added Credit" 
                value={addedAmountInput}
                onChange={(e) => setAddedAmountInput(e.target.value)}
                className="h-8 text-xs font-black px-2 w-24 rounded-lg bg-slate-50/80 dark:bg-slate-900 border-border/80 text-foreground text-center"
              />

              <button
                type="button"
                onClick={() => handleQuickAdd(50)}
                className={`h-8 px-2 text-[10px] font-bold rounded-lg transition-all active:scale-95 ${theme.pill50}`}
              >
                +50
              </button>

              <Button 
                size="sm"
                onClick={handlePayWithRazorpay}
                disabled={totalPaymentRupees <= 0}
                className={`h-8 px-3 text-[11px] font-bold rounded-lg shrink-0 flex items-center gap-1.5 active:scale-95 transition-all ${theme.btnBg}`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Pay Bill (₹{totalPaymentRupees})
              </Button>

              <Button 
                variant="outline"
                className="h-8 w-8 p-0 rounded-lg border-border hover:bg-muted text-muted-foreground flex items-center justify-center shrink-0"
                onClick={() => setShowCoupon(!showCoupon)}
                title="Apply Coupon"
              >
                <Ticket className="w-3.5 h-3.5 text-slate-500" />
              </Button>
            </div>
          </div>
        </Card>

        <PaymentGateway
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          lab={lab}
          initialAmount={totalPaymentRupees}
          onPaymentSuccess={handlePaymentCompleted}
        />
      </>
    );
  }

  return (
    <>
      <Card className="flex flex-col bg-white dark:bg-card border border-border/70 rounded-2xl shadow-xs hover:shadow-md transition-all duration-300 p-4 h-full relative group">
        {/* Header: Icon & Status Badge */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center p-1.5 shrink-0 shadow-2xs ${theme.iconBg}`}>
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
              ) : (
                <MonitorPlay className="w-4 h-4" />
              )}
            </div>
          </div>
          <Badge variant="outline" className={`px-2 py-0.5 text-[8px] font-bold tracking-wider rounded-full ${statusColor}`}>
            {statusText}
          </Badge>
        </div>

        {/* Lab Title */}
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1 mb-3">
          {name}
        </h3>

        {/* Available Credit & Total After Top-Up Box */}
        <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-border/50 rounded-xl p-3 mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-0.5">Available Credit</span>
              <span className="text-base font-black text-foreground">{availableCredit} <span className="text-[10px] font-bold text-muted-foreground">Credits</span></span>
            </div>

            <div className="text-right">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">Total After Top-Up</span>
              <span className={`text-base font-black ${theme.amountText}`}>{newTotalBalance} <span className="text-[10px] font-bold text-muted-foreground">Credits</span></span>
            </div>
          </div>
        </div>

        {/* Editable Added Credit & Presets */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
            <span>Edit Added Credits:</span>
            <span className="text-slate-400">Rate: ₹1 / Credit</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Input 
              type="number"
              min="1"
              placeholder="Credits to add"
              value={addedAmountInput}
              onChange={(e) => setAddedAmountInput(e.target.value)}
              className="h-8 text-xs font-black text-center bg-slate-50/80 dark:bg-slate-900 border-border/80 rounded-lg flex-1"
            />

            <button
              type="button"
              onClick={() => handleQuickAdd(50)}
              className={`h-8 px-2 text-[10px] font-bold rounded-lg transition-all active:scale-95 shrink-0 ${theme.pill50}`}
            >
              +50
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(100)}
              className={`h-8 px-2 text-[10px] font-bold rounded-lg transition-all active:scale-95 shrink-0 ${theme.pill100}`}
            >
              +100
            </button>
          </div>
        </div>

        {/* Payment Summary & Pay Bill Button */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="bg-slate-100/60 dark:bg-slate-900/60 border border-border/40 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-muted-foreground">
                Payment Amount:
              </span>
              <span className="text-sm font-black text-foreground">₹{totalPaymentRupees}</span>
            </div>

            <Button 
              size="sm"
              onClick={handlePayWithRazorpay}
              disabled={totalPaymentRupees <= 0}
              className={`w-full h-8.5 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 ${theme.btnBg}`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pay Bill (₹{totalPaymentRupees})
            </Button>
          </div>

          {/* Footer Links */}
          <div className="flex items-center justify-between text-[9px] font-bold pt-0.5">
            <button 
              onClick={() => setShowCoupon(!showCoupon)}
              className="text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider flex items-center gap-1"
            >
              <Ticket className="w-3 h-3 text-slate-400" />
              {showCoupon ? "Close Coupon" : "Apply Coupon"}
            </button>

            {updateSuccess && (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 animate-in fade-in">
                <CheckCircle2 className="w-3 h-3" /> Paid & Added!
              </span>
            )}
          </div>

          {/* Collapsible Coupon Input */}
          {showCoupon && (
            <div className="flex gap-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-150 relative">
              <Input 
                placeholder="COUPON CODE" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="h-7 text-[10px] px-2 rounded-md bg-slate-50 dark:bg-slate-900 border-border font-bold tracking-wider"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleApplyCoupon}
                disabled={isApplying || !couponCode.trim()}
                className="h-7 px-2.5 text-[10px] font-bold rounded-md border-border"
              >
                {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
              </Button>
              {couponSuccess && (
                <div className="absolute -bottom-4 right-0 text-[8px] font-bold text-emerald-600 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {couponSuccess}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Integrated Payment Gateway Dialog Modal */}
      <PaymentGateway
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        lab={lab}
        initialAmount={totalPaymentRupees}
        onPaymentSuccess={handlePaymentCompleted}
      />
    </>
  );
}
