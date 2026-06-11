import React from 'react';
import { Card } from '@/components/ui/card';
import { Wallet, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface WalletHeroProps {
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  semesterCredits?: number;
}

export function WalletHero({ totalCredits, usedCredits, remainingCredits, semesterCredits = 500 }: WalletHeroProps) {
  const utilization = totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0;
  
  return (
    <Card className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-red-100/50 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-blue-50/50 blur-3xl"></div>
      
      <div className="relative p-8 md:p-10 flex flex-col md:flex-row gap-8 items-center justify-between z-10">
        
        {/* Left Side: Main Balance */}
        <div className="flex-1 w-full space-y-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Wallet className="h-5 w-5 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Available Balance</h2>
          </div>
          
          <div className="flex items-baseline gap-3">
            <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">{remainingCredits}</span>
            <span className="text-xl text-slate-500 font-bold tracking-wide">CRD</span>
          </div>
          
          <div className="pt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 border border-slate-200 dark:border-slate-700">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Current Semester: <strong className="text-slate-900 dark:text-white">{semesterCredits}</strong> allocated</span>
            </div>
          </div>
        </div>
        
        {/* Right Side: Usage Stats */}
        <div className="flex-1 w-full bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> 
              Credit Utilization
            </h3>
            <span className={`text-lg font-extrabold ${utilization > 85 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
              {utilization}%
            </span>
          </div>
          
          <div className="space-y-2 mb-6">
            <Progress 
              value={utilization} 
              className={`h-3 bg-slate-200 dark:bg-slate-800 ${utilization > 85 ? '[&>div]:bg-red-500' : '[&>div]:bg-emerald-500'}`} 
            />
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Used: <strong className="text-slate-900 dark:text-white">{usedCredits}</strong></span>
              <span>Total: <strong className="text-slate-900 dark:text-white">{totalCredits}</strong></span>
            </div>
          </div>

          {utilization > 85 && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <p className="font-medium">Your credit balance is running low. Consider purchasing a top-up soon.</p>
            </div>
          )}
        </div>
        
      </div>
    </Card>
  );
}
