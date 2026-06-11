import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Search, QrCode, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function CertificateVerification() {
  const [certId, setCertId] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certId) return;
    
    setLoading(true);
    // Mock verification delay
    setTimeout(() => {
      setLoading(false);
      setVerified(true);
    }, 1000);
  };

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-950">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" /> Certificate Verification
        </CardTitle>
        <CardDescription className="font-medium mt-1">
          Verify the authenticity of any IgnitoLearn certificate
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col items-center justify-center text-center">
        
        {!verified ? (
          <form onSubmit={handleVerify} className="w-full max-w-sm space-y-4">
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
              <QrCode className="h-8 w-8" />
            </div>
            <p className="text-sm text-slate-500 mb-6">Enter the unique Certificate ID found at the bottom of the document to verify its status.</p>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="e.g. IGN-PY-90821" 
                className="pl-10 text-center font-mono uppercase tracking-wider bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
              />
            </div>
            
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" disabled={!certId || loading}>
              {loading ? 'Verifying...' : 'Verify Certificate'}
            </Button>
          </form>
        ) : (
          <div className="w-full max-w-sm animate-in zoom-in-95 fade-in duration-300">
            <div className="mx-auto w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 text-white">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Authentic Certificate</h3>
            <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-6">{certId.toUpperCase()}</p>
            
            <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg p-4 text-left space-y-3 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs text-slate-500">Status</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">VERIFIED</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Issued To</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Registered Student</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Issued By</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">IgnitoLearn Labs</span>
              </div>
            </div>

            <Button variant="outline" className="w-full mt-6" onClick={() => { setVerified(false); setCertId(''); }}>
              Verify Another
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
