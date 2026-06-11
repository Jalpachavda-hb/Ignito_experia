import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SecurityInfoCardProps {
  student: StudentProfile;
}

export function SecurityInfoCard({ student }: SecurityInfoCardProps) {
  const securityItems = [
    {
      label: 'Email Verified',
      status: student.emailVerified,
      value: student.email
    },
    {
      label: 'Mobile Verified',
      status: student.mobileVerified,
      value: student.mobile
    },
    {
      label: 'Two Factor Authentication',
      status: student.twoFactorEnabled,
      value: student.twoFactorEnabled ? 'Enabled via Authenticator App' : 'Disabled'
    }
  ];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" /> Security Information
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Password Last Changed</p>
              <p className="text-xs text-slate-500 mt-1">
                {student.passwordLastChanged 
                  ? new Date(student.passwordLastChanged).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
                  : 'Not Provided'}
              </p>
            </div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded">
              Secure
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
