import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GraduationCap, MonitorPlay, CreditCard, Minus, Plus, Ticket, CheckCircle2, Loader2 } from 'lucide-react';
import { Lab } from '../../my-labs/types';

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

export function LabCreditCard({ lab, creditInfo, onTopUp, onApplyCoupon, view = 'grid' }: LabCreditCardProps) {
  const [topUpAmount, setTopUpAmount] = useState(100);
  const [couponCode, setCouponCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);

  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const semester = lab.semester || 'Semester 1';
  const category = (lab.category || 'General').toUpperCase();
  
  const { remaining } = creditInfo;
  
  // Muted, light shadcn color tokens
  let statusText = 'Sufficient';
  let statusColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  let amountColor = 'text-emerald-600 dark:text-emerald-400';
  let buttonStyle = 'border-emerald-600/30 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400';
  
  if (remaining === 0) {
    statusText = 'Exhausted';
    statusColor = 'bg-destructive/10 text-destructive border-destructive/20';
    amountColor = 'text-destructive';
    buttonStyle = 'border-destructive/30 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 dark:border-destructive/40';
  } else if (remaining <= 20) {
    statusText = 'Low Credits';
    statusColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    amountColor = 'text-amber-600 dark:text-amber-400';
    buttonStyle = 'border-amber-600/30 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400';
  }

  const handleIncrement = () => setTopUpAmount(prev => prev + 50);
  const handleDecrement = () => setTopUpAmount(prev => Math.max(50, prev - 50));

  const handleBuy = () => {
    onTopUp(lab.id, topUpAmount);
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
    }, 1000);
  };

  // Shared balance box layout
  const BalanceDisplay = () => (
    <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/40 dark:border-border/20 p-3 rounded-xl flex justify-between items-center transition-colors">
      <div>
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Available Balance</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-black ${amountColor}`}>{remaining}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">Credits</span>
        </div>
      </div>
      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></div>
    </div>
  );

  if (view === 'list') {
    return (
      <Card className="flex flex-col lg:flex-row bg-white dark:bg-card border border-border/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-4 gap-4 items-center">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0 w-full">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border/80 flex items-center justify-center p-1.5 shadow-sm">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
            ) : (
              <MonitorPlay className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <Badge variant="outline" className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${statusColor}`}>
                {statusText}
              </Badge>
              <Badge variant="outline" className="px-1.5 py-0.5 text-[7px] font-semibold tracking-wider text-muted-foreground border-border/50">
                {category}
              </Badge>
            </div>
            <h3 className="text-sm font-bold text-foreground leading-snug truncate">
              {name}
            </h3>
            <div className="flex items-center gap-1 mt-0.5 text-muted-foreground text-[10px] font-medium">
              <GraduationCap className="w-3 h-3 text-muted-foreground/80" />
              <span className="uppercase tracking-wider font-extrabold">{semester}</span>
            </div>
          </div>
        </div>

        {/* Center: Balance Display */}
        <div className="w-[200px] shrink-0 w-full lg:w-auto">
          <BalanceDisplay />
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto shrink-0">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-border/80 rounded-xl p-0.5 w-24 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
              onClick={handleDecrement}
            >
              <Minus className="w-2.5 h-2.5" />
            </Button>
            <span className="text-[11px] font-bold text-foreground">{topUpAmount}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
              onClick={handleIncrement}
            >
              <Plus className="w-2.5 h-2.5" />
            </Button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              className={`flex-1 sm:w-24 font-semibold text-[11px] h-8 rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1 ${buttonStyle}`}
              onClick={handleBuy}
            >
              <CreditCard className="w-3 h-3" /> Top Up
            </Button>

            {/* Coupon Button */}
            <div className="relative">
              <Button 
                variant="outline"
                className="h-8 w-8 p-0 rounded-lg border-border hover:bg-muted text-muted-foreground flex items-center justify-center"
                onClick={() => setShowCoupon(!showCoupon)}
              >
                <Ticket className="w-3.5 h-3.5" />
              </Button>

              {showCoupon && (
                <div className="absolute right-0 top-10 bg-card border border-border rounded-xl p-2.5 shadow-xl z-50 flex gap-1.5 w-52 animate-in fade-in slide-in-from-top-2 duration-150">
                  <Input 
                    placeholder="Code" 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="h-7 text-[10px] rounded-md bg-slate-50 dark:bg-slate-900 border-border font-bold"
                  />
                  <Button 
                    className="h-7 px-2 text-[10px] font-bold rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 transition-colors"
                    onClick={handleApplyCoupon}
                    disabled={isApplying || !couponCode.trim()}
                  >
                    {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                  </Button>
                  {couponSuccess && (
                    <div className="absolute -bottom-4 right-2 flex items-center gap-0.5 text-[8px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-2 h-2" /> {couponSuccess}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </Card>
    );
  }

  return (
    <Card className="flex flex-col bg-white dark:bg-card border border-border/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-4 h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border/80 flex items-center justify-center p-1.5 shadow-sm">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
          ) : (
            <MonitorPlay className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <Badge variant="outline" className={`px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${statusColor}`}>
          {statusText}
        </Badge>
      </div>

      {/* Info Block */}
      <div className="mb-3">
        <Badge variant="outline" className="px-1.5 py-0.5 text-[7px] font-semibold tracking-wider text-muted-foreground border-border/50 uppercase mb-0.5">
          {category}
        </Badge>
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1">
          {name}
        </h3>
        <div className="flex items-center gap-1 mt-0.5 text-muted-foreground text-[10px] font-medium">
          <GraduationCap className="w-3 h-3 text-muted-foreground/80" />
          <span className="uppercase tracking-wider font-extrabold">{semester}</span>
        </div>
      </div>

      {/* Balance Display */}
      <div className="mb-4">
        <BalanceDisplay />
      </div>

      {/* Action Zone (Counter + Top Up Button) */}
      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          {/* Top-up adjustments */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-border/80 rounded-xl p-0.5 w-24 shrink-0 shadow-inner">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
              onClick={handleDecrement}
            >
              <Minus className="w-2.5 h-2.5" />
            </Button>
            <span className="text-[11px] font-bold text-foreground">{topUpAmount}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
              onClick={handleIncrement}
            >
              <Plus className="w-2.5 h-2.5" />
            </Button>
          </div>

          {/* Buy Button */}
          <Button 
            variant="outline"
            className={`flex-1 font-semibold text-[11px] h-8 rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1 ${buttonStyle}`}
            onClick={handleBuy}
          >
            <CreditCard className="w-3 h-3" /> Top Up
          </Button>
        </div>

        {/* Coupon Collapsible trigger link */}
        <div className="flex flex-col items-center">
          <button 
            onClick={() => setShowCoupon(!showCoupon)}
            className="text-[8px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider flex items-center gap-1 mt-0.5"
          >
            <Ticket className="w-3 h-3" />
            {showCoupon ? "Close Coupon" : "Apply Coupon"}
          </button>

          {showCoupon && (
            <div className="w-full flex gap-1 mt-2.5 animate-in fade-in slide-in-from-top-2 duration-200 relative">
              <div className="relative flex-1">
                <Input 
                  placeholder="Coupon Code" 
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="h-8 text-[10px] pl-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border-border font-bold placeholder:font-medium placeholder:text-muted-foreground"
                />
              </div>
              <Button 
                variant="outline" 
                className="h-8 px-2.5 text-[10px] font-bold rounded-lg border-border hover:bg-muted text-muted-foreground transition-colors"
                onClick={handleApplyCoupon}
                disabled={isApplying || !couponCode.trim()}
              >
                {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
              </Button>
              {couponSuccess && (
                <div className="absolute -bottom-4 left-0 right-0 flex items-center justify-center gap-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-bottom-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {couponSuccess}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
