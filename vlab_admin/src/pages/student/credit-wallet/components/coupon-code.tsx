import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ticket, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function CouponCode() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleRedeem = () => {
    if (!code.trim()) return;
    
    setStatus('loading');
    
    // Simulate API call
    setTimeout(() => {
      if (code.toUpperCase() === 'FREE50' || code.toUpperCase() === 'WELCOME100') {
        setStatus('success');
      } else {
        setStatus('error');
      }
    }, 1000);
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Ticket className="h-5 w-5 text-indigo-500" /> Redeem Coupon
        </CardTitle>
        <CardDescription>
          Use promotional or institution-provided coupon codes to receive additional credits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input 
            placeholder="ENTER-COUPON-CODE" 
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setStatus('idle');
            }}
            className="uppercase font-mono tracking-wider"
          />
          <Button 
            onClick={handleRedeem} 
            disabled={!code || status === 'loading' || status === 'success'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {status === 'loading' ? 'Applying...' : 'Apply'}
          </Button>
        </div>

        {status === 'success' && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Coupon Applied Successfully!</AlertTitle>
            <AlertDescription>
              Bonus credits have been added to your wallet balance.
            </AlertDescription>
          </Alert>
        )}

        {status === 'error' && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid Code</AlertTitle>
            <AlertDescription>
              The coupon code you entered is invalid or has expired.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
