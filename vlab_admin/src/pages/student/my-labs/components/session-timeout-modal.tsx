import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { LabSession, fetchLabSessionStatus, stopLabSession } from '@/services/labService';

interface SessionTimeoutModalProps {
  session: LabSession | null;
}

export function SessionTimeoutModal({ session }: SessionTimeoutModalProps) {
  const [isTimeOut, setIsTimeOut] = useState(false);
  const [message, setMessage] = useState('Your lab session has expired. You will now be redirected to the dashboard.');

  useEffect(() => {
    if (!session?.sessionId || session.status !== 'running') {
      setIsTimeOut(false);
      return;
    }

    const checkTimeout = async () => {
      // 1. Client-side duration timer check
      if (session.expiresAt) {
        const expiresMs = new Date(session.expiresAt).getTime();
        if (Date.now() >= expiresMs) {
          setMessage('Your lab session has expired. You will now be redirected to the dashboard.');
          setIsTimeOut(true);
          // Trigger stop API call to clean up AWS/Docker resources immediately
          stopLabSession(session.sessionId).catch((err) => {
            console.warn("Failed to trigger session auto-stop:", err);
          });
          return;
        }
      }

      // 2. Query backend to verify if ECS task/session is still active
      try {
        const currentSession = await fetchLabSessionStatus(session.sessionId);
        if (!currentSession || currentSession.status === 'stopped' || currentSession.status === 'failed') {
          setMessage('Your lab session has been stopped or disconnected. You will now be redirected to the dashboard.');
          setIsTimeOut(true);
        }
      } catch (err: any) {
        // If API returns 404 (session deleted from DB/memory) or network error
        setMessage('Your lab session has expired or is no longer active. You will now be redirected to the dashboard.');
        setIsTimeOut(true);
      }
    };

    // Run first check immediately
    checkTimeout();

    // Poll every 10 seconds to check if container is still running
    const interval = setInterval(checkTimeout, 10000);
    return () => clearInterval(interval);
  }, [session]);

  const handleGoToDashboard = () => {
    setIsTimeOut(false);
    window.location.href = '/student/dashboard';
  };

  return (
    <Dialog open={isTimeOut}>
      {/* We do not use onOpenChange here so the user cannot escape it */}
      <DialogContent className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-6 sm:max-w-sm flex flex-col items-center gap-4 text-center [&>button]:hidden">
        <AlertTriangle size={48} className="text-amber-500 mb-2" />
        <h2 className="text-white text-xl font-black uppercase tracking-tighter">
          Session Ended
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          {message}
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

