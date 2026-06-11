import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GraduationCap, MonitorPlay, CreditCard, Minus, Plus, Ticket, CheckCircle2 } from 'lucide-react';
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

  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const semester = lab.semester || 'Semester 1';
  const category = (lab.category || 'General').toUpperCase();
  
  const { allocated, used, remaining } = creditInfo;
  const progressPercentage = allocated > 0 ? Math.min(Math.round((used / allocated) * 100), 100) : 0;

  // Determine status badge
  let status = 'SUFFICIENT';
  let statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
  
  if (remaining === 0) {
    status = 'EXHAUSTED';
    statusColor = 'bg-red-50 text-red-600 border-red-100';
  } else if (remaining <= 20) {
    status = 'LOW CREDITS';
    statusColor = 'bg-amber-50 text-amber-600 border-amber-100';
  }

  const handleIncrement = () => setTopUpAmount(prev => prev + 50);
  const handleDecrement = () => setTopUpAmount(prev => Math.max(50, prev - 50));

  const handleBuy = () => {
    onTopUp(lab.id, topUpAmount);
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    setIsApplying(true);
    // Simulate API call
    setTimeout(() => {
      setIsApplying(false);
      onApplyCoupon(lab.id, couponCode);
      setCouponSuccess('Coupon applied successfully!');
      setCouponCode('');
      setTimeout(() => setCouponSuccess(''), 3000);
    }, 1000);
  };

  if (view === 'list') {
    return (
      <Card className="flex flex-col lg:flex-row bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="p-6 flex flex-col md:flex-row lg:w-1/3 items-start md:items-center gap-5 lg:border-r border-slate-100">
          <div className="w-16 h-16 shrink-0 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-3 shadow-sm">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
            ) : (
              <MonitorPlay className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <Badge className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider ${statusColor} border`}>
                {status}
              </Badge>
              <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-slate-400 border-slate-200">
                {category}
              </Badge>
            </div>
            <h3 className="text-[17px] font-bold text-slate-900 leading-snug truncate">
              {name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-sm font-medium">
              <GraduationCap className="w-4 h-4" />
              <span className="uppercase tracking-wider text-[11px] font-bold">{semester}</span>
            </div>
          </div>
        </div>

        {/* Balance Box */}
        <div className="p-6 lg:w-1/3 lg:border-r border-slate-100 flex flex-col justify-center bg-slate-50/50">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Available Balance</p>
              <p className="text-2xl font-black text-slate-900 leading-none">{remaining}</p>
            </div>
            <div className="text-[13px] font-bold text-slate-400 uppercase tracking-widest text-right mb-1">
              Credits
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-6 lg:w-1/3 flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-[14px] p-1.5 shadow-inner w-32 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-100 text-slate-600"
                onClick={handleDecrement}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="text-base font-black text-slate-900">{topUpAmount}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                onClick={handleIncrement}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button 
              className="flex-1 bg-[#0a1128] hover:bg-[#141e3c] text-white font-bold h-11 rounded-[14px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              onClick={handleBuy}
            >
              <CreditCard className="w-4 h-4" /> BUY
            </Button>
          </div>

          <div className="flex gap-2 relative">
             {/* Coupon */}
            <div className="relative flex-1">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Coupon Code" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="pl-9 h-11 rounded-[12px] bg-slate-50 border-slate-200 text-sm font-bold placeholder:font-medium placeholder:text-slate-400 focus-visible:ring-slate-300"
              />
            </div>
            <Button 
              variant="outline" 
              className="h-11 px-4 font-bold rounded-[12px] border-slate-200 hover:bg-slate-50 text-slate-700"
              onClick={handleApplyCoupon}
              disabled={isApplying || !couponCode.trim()}
            >
              Apply
            </Button>
            {couponSuccess && (
              <div className="absolute -bottom-5 left-0 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 animate-in fade-in slide-in-from-bottom-1">
                <CheckCircle2 className="w-3 h-3" />
                {couponSuccess}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden h-full">
      {/* Header Section */}
      <div className="p-6 pb-4">
        <div className="flex justify-between items-start mb-5">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-3 shadow-sm">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
            ) : (
              <MonitorPlay className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider ${statusColor} border`}>
              {status}
            </Badge>
            <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-bold tracking-wider text-slate-400 border-slate-200">
              {category}
            </Badge>
          </div>
        </div>

        <div>
          <h3 className="text-[17px] font-bold text-slate-900 leading-snug line-clamp-1">
            {name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 text-slate-500 text-sm font-medium">
            <GraduationCap className="w-4 h-4" />
            <span className="uppercase tracking-wider text-[11px] font-bold">{semester}</span>
          </div>
        </div>
      </div>

      {/* Balance Box */}
      <div className="px-6 mb-5">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex justify-between items-center">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-2xl font-black text-slate-900 leading-none">{remaining}</p>
          </div>
          <div className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">
            Credits
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="p-6 pt-0 mt-auto flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Top-up Value
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-[14px] p-1.5 shadow-inner">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-100 text-slate-600"
                onClick={handleDecrement}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-lg font-black text-slate-900">{topUpAmount}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-10 h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                onClick={handleIncrement}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button 
            className="w-full bg-[#0a1128] hover:bg-[#141e3c] text-white font-bold h-12 rounded-[14px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
            onClick={handleBuy}
          >
            <CreditCard className="w-4 h-4" /> BUY {topUpAmount} CREDITS
          </Button>
        </div>

        {/* Divider */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-2 text-[10px] font-bold uppercase tracking-widest text-slate-300">or</span>
          </div>
        </div>

        {/* Coupon Section */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Coupon Code" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="pl-9 h-11 rounded-[12px] bg-slate-50 border-slate-200 text-sm font-bold placeholder:font-medium placeholder:text-slate-400 focus-visible:ring-slate-300"
              />
            </div>
            <Button 
              variant="outline" 
              className="h-11 px-4 font-bold rounded-[12px] border-slate-200 hover:bg-slate-50 text-slate-700"
              onClick={handleApplyCoupon}
              disabled={isApplying || !couponCode.trim()}
            >
              Apply
            </Button>
          </div>
          {couponSuccess && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 mt-1 justify-center animate-in fade-in slide-in-from-bottom-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {couponSuccess}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
