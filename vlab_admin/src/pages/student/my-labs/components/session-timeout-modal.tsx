import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { LabSession } from '@/services/labService';

interface SessionTimeoutModalProps {
  session: LabSession | null;
  onRestart?: () => void;
}

export function SessionTimeoutModal({ session, onRestart }: SessionTimeoutModalProps) {
  const [isTimeOut, setIsTimeOut] = useState(false);

  useEffect(() => {
    if (!session?.expiresAt || session.status !== 'running') {
      setIsTimeOut(false);
      return;
    }

    const checkTimeout = () => {
      const expiresMs = new Date(session.expiresAt!).getTime();
      if (Date.now() >= expiresMs) {
        setIsTimeOut(true);
      }
    };

    checkTimeout();
    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handleGoToDashboard = () => {
    setIsTimeOut(false);
    window.location.href = '/student'; // Replace with proper route if needed
  };

  const handleRestart = () => {
    setIsTimeOut(false);
    if (onRestart) {
      onRestart();
    } else {
      window.location.reload();
    }
  };

  return (
    <Dialog open={isTimeOut}>
      {/* We do not use onOpenChange here so the user cannot escape it */}
      <DialogContent className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-6 sm:max-w-sm flex flex-col items-center gap-4 text-center [&>button]:hidden">
        <AlertTriangle size={48} className="text-amber-500 mb-2" />
        <h2 className="text-white text-xl font-black uppercase tracking-tighter">
          Session Time Out
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          Your lab session has expired. You will now be redirected to the dashboard.
        </p>
        <div className="flex gap-3 w-full mt-2">
          <Button 
            onClick={handleGoToDashboard} 
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black tracking-widest uppercase"
          >
            Go to Dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
