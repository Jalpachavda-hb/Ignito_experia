import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Package {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
}

const predefinedPackages: Package[] = [
  { id: 'pkg-1', name: 'Starter Pack', credits: 100, price: 99 },
  { id: 'pkg-2', name: 'Student Pack', credits: 250, price: 199, popular: true },
  { id: 'pkg-3', name: 'Semester Pack', credits: 500, price: 349 },
  { id: 'pkg-4', name: 'Premium Pack', credits: 1000, price: 599 },
];

export function PurchaseCredits() {
  const [customCredits, setCustomCredits] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const creditRate = 0.8; // ₹0.8 per credit for custom purchases
  const estimatedAmount = customCredits ? Math.max(1, Math.round(parseInt(customCredits) * creditRate)) : 0;

  const handlePurchase = (pkgId: string, credits: number, price: number) => {
    setIsProcessing(pkgId);
    
    // Simulate API call
    setTimeout(() => {
      toast.success("Purchase Successful", {
        description: `Successfully added ${credits} credits to your wallet for ₹${price}.`,
      });
      setIsProcessing(null);
      if (pkgId === 'custom') setCustomCredits('');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {predefinedPackages.map((pkg) => (
          <Card 
            key={pkg.id} 
            className={`relative flex flex-col border-2 transition-all hover:border-red-500/50 hover:shadow-lg ${pkg.popular ? 'border-red-500 shadow-md' : 'border-slate-100 dark:border-slate-800'}`}
          >
            {pkg.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                Most Popular
              </div>
            )}
            <CardHeader className="text-center pb-2 pt-8">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">{pkg.name}</CardTitle>
              <div className="mt-4 flex justify-center items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">₹{pkg.price}</span>
              </div>
              <CardDescription className="font-semibold text-red-500 mt-2">
                {pkg.credits} Credits
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 mt-4">
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 mb-6 flex-1">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Instant activation</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Valid for 1 year</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Access all labs</li>
              </ul>
              
              <Button 
                onClick={() => handlePurchase(pkg.id, pkg.credits, pkg.price)}
                disabled={isProcessing !== null}
                className={`w-full font-semibold ${pkg.popular ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900'}`}
              >
                {isProcessing === pkg.id ? 'Processing...' : 'Buy Now'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 bg-slate-50/50 dark:bg-slate-900/50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <CreditCard className="h-5 w-5 text-red-500" /> Buy Custom Credits
              </h3>
              <p className="text-sm text-slate-500 mt-1">Need a specific amount? Purchase exactly what you need.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full md:w-auto">
              <div className="grid gap-2 w-full sm:w-40">
                <Label htmlFor="custom-credits" className="text-xs font-semibold text-slate-600">Number of Credits</Label>
                <Input 
                  id="custom-credits" 
                  type="number" 
                  min="1"
                  placeholder="e.g. 150" 
                  value={customCredits}
                  onChange={(e) => setCustomCredits(e.target.value)}
                  className="bg-white dark:bg-slate-950"
                />
              </div>
              
              <div className="grid gap-2 w-full sm:w-32">
                <Label className="text-xs font-semibold text-slate-600">Estimated Price</Label>
                <div className="h-10 px-3 flex items-center bg-slate-200 dark:bg-slate-800 rounded-md text-sm font-bold text-slate-900 dark:text-white">
                  ₹{estimatedAmount}
                </div>
              </div>
              
              <Button 
                onClick={() => handlePurchase('custom', parseInt(customCredits), estimatedAmount)}
                disabled={!customCredits || parseInt(customCredits) <= 0 || isProcessing !== null}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
              >
                {isProcessing === 'custom' ? 'Processing...' : 'Purchase'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
