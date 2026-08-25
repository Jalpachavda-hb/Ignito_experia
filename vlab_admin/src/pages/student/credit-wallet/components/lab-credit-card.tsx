import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MonitorPlay, Ticket, CheckCircle2, Loader2, CreditCard, Clock, Coins, Info, Minus, Plus, HelpCircle, Check, Zap, Sparkles } from 'lucide-react';
import { Lab } from '../../my-labs/types';
import { PaymentGateway } from '../../my-labs/components/payment-gateway';
import { initiateRazorpayPayment, detectPaymentMethod } from '@/Utils/razorpayHandler';
import { useAuthStore } from '@/stores/auth-store';
import { useTransactionStore } from '@/stores/transactionStore';

export interface LabTokenInfo {
  availableTokens: number;
  reservedTokens: number;
}

interface LabCreditCardProps {
  lab: Lab;
  tokenInfo: LabTokenInfo;
  effectivePricePer60Tokens?: number;
  isSelectedForCart?: boolean;
  onToggleSelectForCart?: () => void;
  onTokensChange?: (tokens: number) => void;
  onTopUp?: (labId: string, amount: number) => void;
  onApplyCoupon?: (labId: string, code: string) => void;
  view?: 'grid' | 'list';
}

const colorThemes = [
  {
    name: 'indigo',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 text-indigo-600 dark:text-indigo-400',
    pillActive: 'border-2 border-red-500 text-red-600 dark:text-red-400 font-black bg-red-50/50 dark:bg-red-950/30 shadow-xs',
    pillInactive: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 font-bold',
  },
  {
    name: 'blue',
    iconBg: 'bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 text-sky-600 dark:text-sky-400',
    pillActive: 'border-2 border-red-500 text-red-600 dark:text-red-400 font-black bg-red-50/50 dark:bg-red-950/30 shadow-xs',
    pillInactive: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 font-bold',
  },
  {
    name: 'emerald',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-emerald-600 dark:text-emerald-400',
    pillActive: 'border-2 border-red-500 text-red-600 dark:text-red-400 font-black bg-red-50/50 dark:bg-red-950/30 shadow-xs',
    pillInactive: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 font-bold',
  },
  {
    name: 'violet',
    iconBg: 'bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 text-violet-600 dark:text-violet-400',
    pillActive: 'border-2 border-red-500 text-red-600 dark:text-red-400 font-black bg-red-50/50 dark:bg-red-950/30 shadow-xs',
    pillInactive: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 font-bold',
  },
];

const getTheme = (idOrName: string) => {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorThemes[Math.abs(hash) % colorThemes.length];
};

export function LabCreditCard({
  lab,
  tokenInfo,
  effectivePricePer60Tokens = 100,
  isSelectedForCart = false,
  onToggleSelectForCart,
  onTokensChange,
  onTopUp,
  onApplyCoupon,
  view = 'grid'
}: LabCreditCardProps) {
  const { auth } = useAuthStore();
  const user = auth?.user;
  const { addTransaction } = useTransactionStore();

  const [selectedTokens, setSelectedTokens] = useState<number>(60);
  const labId = lab.id || lab.labId || lab.name || 'lab';
  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const theme = getTheme(labId + name);

  const availableTokens = tokenInfo?.availableTokens ?? 0;
  const pricePer60 = lab.baseTokenPrice ?? effectivePricePer60Tokens ?? 100;
  const pricePerToken = pricePer60 / 60;
  const totalPaymentRupees = Math.round(selectedTokens * pricePerToken);

  let statusText = `${availableTokens} Tokens Ready`;
  let statusColor = 'bg-emerald-50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40';

  if (availableTokens === 0) {
    statusText = '0 Tokens';
    statusColor = 'bg-slate-100 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
  } else if (availableTokens <= 30) {
    statusText = 'Low Tokens';
    statusColor = 'bg-amber-50 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40';
  }

  const handleSetTokens = (val: number) => {
    const tokens = Math.max(30, val);
    setSelectedTokens(tokens);
    onTokensChange?.(tokens);
  };

  if (view === 'list') {
    return (
      <>
        <Card className={`flex flex-col lg:flex-row bg-white dark:bg-card border rounded-2xl transition-all duration-300 p-4.5 gap-4 items-center ${isSelectedForCart ? 'border-red-500 ring-2 ring-red-500/20 shadow-md bg-red-50/10' : 'border-slate-200/70 hover:shadow-md hover:border-slate-300'}`}>
          {/* Left: Icon & Lab Name */}
          <div className="flex items-center gap-3.5 flex-1 min-w-0 w-full">
            <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center p-2 shadow-2xs ${theme.iconBg}`}>
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
              ) : (
                <MonitorPlay className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug truncate">
                {name}
              </h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                Lab Rate: <span className="text-slate-800 dark:text-slate-200 font-extrabold">₹{pricePer60} / 60 Tokens</span>
              </p>
            </div>
          </div>

          {/* Available Token Balance */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2 shrink-0">
            <div>
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider block">Student Token Balance</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">{availableTokens} Tokens <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">({availableTokens} Mins)</span></span>
            </div>
          </div>

          {/* Token Preset Stepper */}
          <div className="flex items-center gap-1.5 shrink-0">
            {[30, 60, 120, 180].map((tokenQty) => {
              const isSelected = selectedTokens === tokenQty;
              return (
                <button
                  key={tokenQty}
                  type="button"
                  onClick={() => handleSetTokens(tokenQty)}
                  className={`h-8 px-3 rounded-xl text-xs font-black transition-all border ${isSelected ? theme.pillActive : theme.pillInactive}`}
                >
                  +{tokenQty} Tokens
                </button>
              );
            })}
          </div>

          {/* Unique Action Button */}
          <div className="shrink-0 w-full lg:w-auto">
            <Button 
              variant="outline"
              size="sm"
              onClick={onToggleSelectForCart}
              className={`h-10 px-5 text-xs font-extrabold rounded-xl border-2 flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 shadow-none ${
                isSelectedForCart 
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white' 
                  : 'border-red-500/80 text-red-600 bg-red-50/30 hover:bg-red-600 hover:text-white'
              }`}
            >
              {isSelectedForCart ? (
                <>
                  <Check className="w-4 h-4" />
                  Tokens Allocated ✓ (₹{totalPaymentRupees})
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-red-500" />
                  Select Tokens (₹{totalPaymentRupees})
                </>
              )}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <Card className={`flex flex-col bg-white dark:bg-card border rounded-2xl transition-all duration-300 p-5 h-full relative group ${isSelectedForCart ? 'border-red-500 ring-2 ring-red-500/20 shadow-md bg-red-50/10' : 'border-slate-200/80 hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5'}`}>
        {/* Top Header: Icon, Name & Status Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center p-2 shrink-0 shadow-2xs ${theme.iconBg}`}>
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
              ) : (
                <MonitorPlay className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate leading-snug">
                {name}
              </h3>
              <p className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 mt-0.5">
                Rate: ₹{pricePer60} / 60 Tokens
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`px-2.5 py-0.5 text-[9px] font-extrabold tracking-wider rounded-full shrink-0 ${statusColor}`}>
            {statusText}
          </Badge>
        </div>

        {/* Current Available Token Balance Box */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Student Token Balance
            </span>
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Zap className="w-3 h-3 text-indigo-500 fill-indigo-500" />
              1 Token = 1 Min
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {availableTokens} <span className="text-xs font-bold text-slate-400">Tokens</span>
            </span>
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/50">
              {availableTokens} Mins Runtime
            </span>
          </div>
        </div>

        {/* Token Quantity Selector */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
            <span>Select Runtime Tokens:</span>
            <span className="text-slate-900 dark:text-white font-extrabold">+{selectedTokens} Mins (₹{totalPaymentRupees})</span>
          </div>

          {/* Preset Pills */}
          <div className="grid grid-cols-4 gap-1.5">
            {[30, 60, 120, 180].map((tokenQty) => {
              const isSelected = selectedTokens === tokenQty;
              return (
                <button
                  key={tokenQty}
                  type="button"
                  onClick={() => handleSetTokens(tokenQty)}
                  className={`h-8.5 rounded-xl text-xs font-black transition-all active:scale-95 border ${isSelected ? theme.pillActive : theme.pillInactive}`}
                >
                  +{tokenQty}T
                </button>
              );
            })}
          </div>
        </div>

        {/* Unique Action Button */}
        <div className="mt-auto pt-2">
          <Button 
            variant="outline"
            size="lg"
            onClick={onToggleSelectForCart}
            className={`w-full h-11 text-xs font-extrabold rounded-xl border-2 flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 shadow-none ${
              isSelectedForCart 
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white' 
                : 'border-red-500/80 text-red-600 bg-red-50/30 hover:bg-red-600 hover:text-white'
            }`}
          >
            {isSelectedForCart ? (
              <>
                <Check className="w-4 h-4" />
                Tokens Allocated ✓ (₹{totalPaymentRupees})
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-red-500" />
                Select Tokens (₹{totalPaymentRupees})
              </>
            )}
          </Button>
        </div>
      </Card>
    </>
  );
}
