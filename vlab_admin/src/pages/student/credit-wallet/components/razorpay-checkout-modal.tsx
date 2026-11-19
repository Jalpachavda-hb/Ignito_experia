import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  QrCode,
  Smartphone,
  CreditCard,
  Building2,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
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

type TabType = 'qr' | 'paytm' | 'upi' | 'card' | 'netbanking' | 'razorpay';

export function RazorpayCheckoutModal({
  isOpen,
  onClose,
  items,
  totalTokens,
  totalAmountRupees,
  isProcessing,
  onProceedToPay,
}: RazorpayCheckoutModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('qr');
  const [enteredUpiId, setEnteredUpiId] = useState('');
  const [paytmMobile, setPaytmMobile] = useState('');

  const handleOpenRazorpayWithMethod = (method: 'upi_qr' | 'upi' | 'paytm' | 'card' | 'netbanking' | 'wallet') => {
    onClose();
    setTimeout(() => {
      onProceedToPay(method);
    }, 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 px-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">Ignito Experia Checkout</span>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-bold">
                  All Payment Options
                </Badge>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {items.length} {items.length === 1 ? 'Lab' : 'Labs'} Selected • +{totalTokens} Mins Runtime
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Total Amount</span>
            <span className="text-2xl font-black text-emerald-400 tracking-tight">₹{totalAmountRupees}</span>
          </div>
        </div>

        {/* Content Layout: Left Tabs + Right Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[440px]">
          
          {/* Left Navigation Tabs */}
          <div className="md:col-span-4 bg-slate-50 dark:bg-slate-900/60 p-3 border-r border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1.5 block">
              Payment Methods
            </span>

            {/* TAB 1: QR Code */}
            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                activeTab === 'qr'
                  ? 'bg-white dark:bg-slate-800 border-emerald-500/50 shadow-sm text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'qr' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'}`}>
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">Dynamic QR Code</div>
                  <div className="text-[10px] text-slate-400">Scan with any UPI App</div>
                </div>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">
                Fastest
              </span>
            </button>

            {/* TAB 2: Paytm */}
            <button
              type="button"
              onClick={() => setActiveTab('paytm')}
              className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                activeTab === 'paytm'
                  ? 'bg-white dark:bg-slate-800 border-sky-500/50 shadow-sm text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'paytm' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'}`}>
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">Paytm Payments</div>
                  <div className="text-[10px] text-slate-400">Wallet, QR & UPI</div>
                </div>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 border border-sky-200/50">
                Instant
              </span>
            </button>

            {/* TAB 3: UPI Apps */}
            <button
              type="button"
              onClick={() => setActiveTab('upi')}
              className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                activeTab === 'upi'
                  ? 'bg-white dark:bg-slate-800 border-indigo-500/50 shadow-sm text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'upi' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">UPI Apps & VPA</div>
                  <div className="text-[10px] text-slate-400">GPay, PhonePe, BHIM</div>
                </div>
              </div>
            </button>

            {/* TAB 4: Cards */}
            <button
              type="button"
              onClick={() => setActiveTab('card')}
              className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                activeTab === 'card'
                  ? 'bg-white dark:bg-slate-800 border-rose-500/50 shadow-sm text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'card' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'}`}>
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">Credit / Debit Card</div>
                  <div className="text-[10px] text-slate-400">Visa, MC, RuPay</div>
                </div>
              </div>
            </button>

            {/* TAB 5: Netbanking */}
            <button
              type="button"
              onClick={() => setActiveTab('netbanking')}
              className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                activeTab === 'netbanking'
                  ? 'bg-white dark:bg-slate-800 border-blue-500/50 shadow-sm text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'netbanking' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'}`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">Net Banking</div>
                  <div className="text-[10px] text-slate-400">All Indian Banks</div>
                </div>
              </div>
            </button>

            {/* TAB 6: Razorpay Full Portal */}
            <button
              type="button"
              onClick={() => setActiveTab('razorpay')}
              className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                activeTab === 'razorpay'
                  ? 'bg-white dark:bg-slate-800 border-purple-500/50 shadow-sm text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === 'razorpay' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/60' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">Razorpay Standard</div>
                  <div className="text-[10px] text-slate-400">External Modal</div>
                </div>
              </div>
            </button>
          </div>

          {/* Right Active Method Workspace */}
          <div className="md:col-span-8 p-6 flex flex-col justify-between">

            {/* 1. DYNAMIC QR CODE TAB */}
            {activeTab === 'qr' && (
              <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                    <QrCode className="w-5 h-5 text-emerald-600" />
                    Scan & Pay with Any UPI App
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Open Google Pay, PhonePe, Paytm, BHIM, or any bank app to scan
                  </p>
                </div>

                <div className="w-full p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900 text-left">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    Razorpay will show the UPI QR for ₹{totalAmountRupees}. Tokens are added only after Razorpay confirms the payment.
                  </p>
                </div>

                {/* Supported Brand Badges */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60">GPay</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60">PhonePe</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60">Paytm</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60">BHIM</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60">Cred</span>
                </div>

                {/* Primary Action Button */}
                <div className="w-full space-y-2 pt-2">
                  <Button
                    size="lg"
                    onClick={() => handleOpenRazorpayWithMethod('upi_qr')}
                    disabled={isProcessing}
                    className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Pay ₹{totalAmountRupees} with Razorpay QR
                  </Button>
                </div>
              </div>
            )}

            {/* 2. PAYTM TAB */}
            {activeTab === 'paytm' && (
              <div className="flex flex-col space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-slate-900 dark:text-white">Pay with Paytm</span>
                    <Badge className="bg-sky-500 text-white text-[10px] font-bold">Official Partner</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pay using your Paytm Wallet, Paytm Postpaid, or Paytm UPI ID
                  </p>
                </div>

                <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-sky-900 dark:text-sky-200">Paytm Registered Mobile / UPI</span>
                    <span className="text-[10px] text-slate-400">Enter for instant prompt</span>
                  </div>
                  <Input
                    placeholder="e.g. 9876543210 or yourname@paytm"
                    value={paytmMobile}
                    onChange={(e) => setPaytmMobile(e.target.value)}
                    className="bg-white dark:bg-slate-900 border-sky-300 dark:border-sky-800 rounded-xl h-10 text-xs font-semibold"
                  />
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                    Supports Paytm Wallet balance, linked Bank accounts & Rupay
                  </div>
                </div>

                {/* Scan Paytm QR option */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Paytm in Razorpay</div>
                    <div className="text-[11px] text-slate-400">Wallet, UPI, and linked bank accounts</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-sky-600 border-sky-200 bg-sky-50">
                    Test mode
                  </Badge>
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    size="lg"
                    onClick={() => handleOpenRazorpayWithMethod('paytm')}
                    disabled={isProcessing}
                    className="w-full h-11 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-sky-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    Pay ₹{totalAmountRupees} with Paytm
                  </Button>
                </div>
              </div>
            )}

            {/* 3. UPI APPS TAB */}
            {activeTab === 'upi' && (
              <div className="flex flex-col space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Pay via UPI Apps</h3>
                  <p className="text-xs text-slate-500">
                    Send a direct payment request to your Google Pay, PhonePe, or BHIM app
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEnteredUpiId('student@okhdfcbank')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50 dark:bg-slate-900 text-center transition-all"
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white">Google Pay</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">@okhdfcbank</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnteredUpiId('student@ybl')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50 dark:bg-slate-900 text-center transition-all"
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white">PhonePe</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">@ybl / @ibl</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnteredUpiId('student@paytm')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50 dark:bg-slate-900 text-center transition-all"
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white">Paytm UPI</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">@paytm</div>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block">
                    Virtual Payment Address (VPA / UPI ID)
                  </label>
                  <Input
                    placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                    value={enteredUpiId}
                    onChange={(e) => setEnteredUpiId(e.target.value)}
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl h-10 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    size="lg"
                    onClick={() => handleOpenRazorpayWithMethod('upi')}
                    disabled={isProcessing}
                    className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" />
                    Pay ₹{totalAmountRupees} with UPI
                  </Button>
                </div>
              </div>
            )}

            {/* 4. CARDS TAB */}
            {activeTab === 'card' && (
              <div className="flex flex-col space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Credit & Debit Cards</h3>
                  <p className="text-xs text-slate-500">
                    Pay securely using Visa, MasterCard, RuPay, Maestro, or Diners Club
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-rose-500" />
                    <div>
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">All Indian & Global Cards Supported</div>
                      <div className="text-[11px] text-slate-400">Zero surcharge on domestic debit and credit cards</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300">Visa</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300">MasterCard</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300">RuPay</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300">Maestro</span>
                  </div>
                </div>

                <div className="space-y-2 pt-6">
                  <Button
                    size="lg"
                    onClick={() => handleOpenRazorpayWithMethod('card')}
                    className="w-full h-11 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Card Payment (₹{totalAmountRupees})</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 5. NET BANKING TAB */}
            {activeTab === 'netbanking' && (
              <div className="flex flex-col space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Net Banking</h3>
                  <p className="text-xs text-slate-500">
                    Direct net banking available for 50+ Indian commercial & public sector banks
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> State Bank of India
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> HDFC Bank
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> ICICI Bank
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> Axis Bank
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> Punjab National Bank
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> Bank of Baroda
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <Button
                    size="lg"
                    onClick={() => handleOpenRazorpayWithMethod('netbanking')}
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Proceed with Net Banking (₹{totalAmountRupees})</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 6. RAZORPAY STANDARD TAB */}
            {activeTab === 'razorpay' && (
              <div className="flex flex-col space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Razorpay Standard Modal</h3>
                  <p className="text-xs text-slate-500">
                    Open Razorpay's standard full checkout screen
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    <div>
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">Full Gateway Access</div>
                      <div className="text-[11px] text-slate-400">Includes Wallets, Net Banking, Cards & EMI</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-6">
                  <Button
                    size="lg"
                    onClick={() => handleOpenRazorpayWithMethod('card')}
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Open Razorpay Checkout Popup</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Security Footer inside right panel */}
            <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-500" /> 256-Bit SSL Encrypted
              </span>
              <span>100% Guaranteed Token Credit</span>
            </div>

          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
