import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  QrCode,
  Smartphone,
  CreditCard,
  Building2,
  Wallet,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Zap,
  Loader2,
  Sparkles,
} from 'lucide-react';

export interface CheckoutLabItem {
  labId: string;
  labName: string;
  tokens: number;
  amountRupees: number;
}

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CheckoutLabItem[];
  totalTokens: number;
  totalAmountRupees: number;
  isProcessing: boolean;
  onProceedToPay: (preferredMethod?: 'upi_qr' | 'upi' | 'paytm' | 'card' | 'netbanking' | 'wallet' | 'paylater') => void;
}

type PaymentOptionKey = 'upi_qr' | 'paytm' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'paylater';

interface PaymentMethodDef {
  key: PaymentOptionKey;
  title: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  supportedLogos: string[];
}

const PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    key: 'upi_qr',
    title: 'UPI Dynamic QR Code',
    badge: 'Fastest & Recommended',
    badgeColor: 'bg-emerald-500 text-white font-extrabold',
    description: 'Instant scan with any UPI app: Google Pay, PhonePe, Paytm, BHIM, Cred',
    icon: QrCode,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800',
    supportedLogos: ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Cred'],
  },
  {
    key: 'paytm',
    title: 'Paytm (Wallet & UPI)',
    badge: 'Instant',
    badgeColor: 'bg-sky-500 text-white font-bold',
    description: 'Pay via Paytm Wallet balance, linked bank account, or Paytm UPI',
    icon: Wallet,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200/80 dark:border-sky-800',
    supportedLogos: ['Paytm Wallet', 'Paytm UPI', 'Postpaid'],
  },
  {
    key: 'upi',
    title: 'UPI Apps & VPA ID',
    description: 'Pay via installed UPI apps on your mobile/PC or enter any Virtual Payment Address',
    icon: Smartphone,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-800',
    supportedLogos: ['Google Pay', 'PhonePe', 'BHIM', 'Amazon Pay'],
  },
  {
    key: 'card',
    title: 'Credit / Debit / ATM Cards',
    description: 'Visa, MasterCard, RuPay, Maestro, and Diners Club (All Indian & Global banks)',
    icon: CreditCard,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200/80 dark:border-rose-800',
    supportedLogos: ['Visa', 'MasterCard', 'RuPay', 'Maestro'],
  },
  {
    key: 'netbanking',
    title: 'Net Banking (50+ Indian Banks)',
    description: 'SBI, HDFC, ICICI, Axis, Kotak, PNB, Canara, Bank of Baroda, and all major banks',
    icon: Building2,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200/80 dark:border-blue-800',
    supportedLogos: ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak'],
  },
  {
    key: 'wallet',
    title: 'Digital Wallets & PayLater',
    description: 'PhonePe Wallet, MobiKwik, Freecharge, Airtel Money, Simpl, and LazyPay',
    icon: Clock,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200/80 dark:border-amber-800',
    supportedLogos: ['MobiKwik', 'Freecharge', 'Airtel Money', 'Simpl'],
  },
];

export function RazorpayCheckoutModal({
  isOpen,
  onClose,
  items,
  totalTokens,
  totalAmountRupees,
  isProcessing,
  onProceedToPay,
}: RazorpayCheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentOptionKey>('upi_qr');

  const handlePay = (methodToUse?: PaymentOptionKey) => {
    const finalMethod = methodToUse || selectedMethod;
    onProceedToPay(finalMethod);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 pb-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Razorpay Secure Checkout
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-bold">
                    All Options Active
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 font-medium mt-0.5">
                  Select your preferred payment method or pay with any option via Razorpay
                </DialogDescription>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Amount</span>
              <span className="text-2xl font-black text-white tracking-tight">₹{totalAmountRupees}</span>
            </div>
          </div>

          {/* Quick Order Snapshot */}
          <div className="mt-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-extrabold text-white">
                {items.length} {items.length === 1 ? 'Lab' : 'Labs'} Selected
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300 font-medium">+{totalTokens} Minutes Lab Runtime</span>
            </div>
            <span className="text-[11px] font-mono text-indigo-300 font-bold">1 Token = ₹1</span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[50vh]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Choose Payment Method
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Click any method to launch directly
            </span>
          </div>

          {/* Payment Method Cards */}
          <div className="grid grid-cols-1 gap-2.5">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.key;

              return (
                <div
                  key={method.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedMethod(method.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMethod(method.key);
                    }
                  }}
                  className={`group relative p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer text-left flex items-center gap-3.5 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${method.iconBg}`}>
                    <Icon className={`w-5 h-5 ${method.iconColor}`} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {method.title}
                      </span>
                      {method.badge && (
                        <span className={`text-[9px] px-2 py-0.5 rounded-full ${method.badgeColor}`}>
                          {method.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {method.description}
                    </p>

                    {/* Supported Sub-Tags */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {method.supportedLogos.map((logo) => (
                        <span
                          key={logo}
                          className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200/60 dark:border-slate-700/60"
                        >
                          {logo}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Radio indicator */}
                  <div className="shrink-0 flex items-center">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>256-Bit Encrypted • Powered by Razorpay</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                onClick={onClose}
                disabled={isProcessing}
                className="h-11 rounded-xl text-xs font-bold text-slate-600 border-slate-200 dark:border-slate-700"
              >
                Cancel
              </Button>

              <Button
                size="lg"
                onClick={() => handlePay()}
                disabled={isProcessing}
                className="flex-1 sm:flex-initial h-11 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening Checkout...
                  </>
                ) : (
                  <>
                    <span>Pay ₹{totalAmountRupees} via Razorpay</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
