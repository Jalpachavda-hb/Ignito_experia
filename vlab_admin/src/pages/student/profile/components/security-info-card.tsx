import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { ShieldCheck, CheckCircle2, KeyRound, Lock, Smartphone } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { PasswordSetupModal } from '@/components/auth/PasswordSetupModal';

interface SecurityInfoCardProps {
  student: StudentProfile;
}

export function SecurityInfoCard({ student }: SecurityInfoCardProps) {
  const { auth } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const hasPassword = auth.user?.hasPassword ?? Boolean(student.passwordLastChanged);

  return (
    <>
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-card h-full flex flex-col justify-between">
        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-slate-500" /> Security & Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-5">

          {/* Direct Login Password Setting */}
          <div className="p-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-slate-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Experia Direct Login Password</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {hasPassword 
                      ? 'Direct login password is set. You can sign in via both LMS SSO and direct password.' 
                      : 'Set a password to enable direct portal login in addition to LMS SSO.'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`${
                hasPassword 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0 font-medium' 
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 shrink-0 font-medium'
              }`}>
                {hasPassword ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
                {hasPassword ? 'Password Set' : 'SSO Only'}
              </Badge>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-200/60 dark:border-slate-800">
              <Button 
                onClick={() => setShowPasswordModal(true)} 
                variant={hasPassword ? 'outline' : 'default'}
                size="sm"
                className="gap-2 text-xs"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {hasPassword ? 'Change Password' : 'Set Password'}
              </Button>
            </div>
          </div>

          {/* Two Factor Authentication */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Two-Factor Authentication (2FA)</p>
                <p className="text-xs text-slate-500">Authenticator App Protection</p>
              </div>
            </div>
            <Badge variant="outline" className={`${
              student.twoFactorEnabled 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium' 
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 font-medium'
            }`}>
              {student.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

        </CardContent>
      </Card>

      <PasswordSetupModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
}
