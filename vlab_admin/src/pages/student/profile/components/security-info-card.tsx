import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { ShieldCheck, CheckCircle2, AlertTriangle, KeyRound, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { PasswordSetupModal } from '@/components/auth/PasswordSetupModal';

interface SecurityInfoCardProps {
  student: StudentProfile;
}

export function SecurityInfoCard({ student }: SecurityInfoCardProps) {
  const { auth } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const hasPassword = auth.user?.hasPassword ?? Boolean(student.passwordLastChanged);

  const securityItems = [
    {
      label: 'Mobile Verified',
      status: student.mobileVerified,
      value: student.mobile || 'Not provided'
    },
    {
      label: 'Two Factor Authentication',
      status: student.twoFactorEnabled,
      value: student.twoFactorEnabled ? 'Enabled via Authenticator App' : 'Disabled'
    }
  ];

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/40">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" /> Security & Password
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">

          {/* Experia Direct Password Setting Field */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Experia Direct Login Password</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {hasPassword 
                      ? 'Direct login password is set. You can log in via both LMS SSO and direct password.' 
                      : 'You authenticated via LMS SSO. Set a direct password to log in directly on your university portal.'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`${
                hasPassword 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900 shrink-0' 
                  : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900 shrink-0'
              }`}>
                {hasPassword ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                {hasPassword ? 'Direct Login Enabled' : 'Not Set (LMS Only)'}
              </Badge>
            </div>

            <div className="pt-2 flex justify-end">
              <Button 
                onClick={() => setShowPasswordModal(true)} 
                variant={hasPassword ? 'outline' : 'default'}
                size="sm"
                className="gap-2"
              >
                <KeyRound className="h-4 w-4" />
                {hasPassword ? 'Change Experia Password' : 'Set Direct Password Now'}
              </Button>
            </div>
          </div>

          {/* Additional Security Items */}
          <div className="space-y-4 pt-2">
            {securityItems.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.value}</p>
                </div>
                <Badge variant="outline" className={`${
                  item.status 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' 
                    : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
                }`}>
                  {item.status ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {item.status ? 'Verified' : 'Action Required'}
                </Badge>
              </div>
            ))}
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
