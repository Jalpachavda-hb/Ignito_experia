import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { Settings, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface AccountInfoCardProps {
  student: StudentProfile;
}

export function AccountInfoCard({ student }: AccountInfoCardProps) {
  const { auth } = useAuthStore();
  const u: any = auth.user || {};

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-card h-full flex flex-col justify-between">
      <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <Settings className="h-4 w-4 text-slate-500" /> Account Information
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
          <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Authentication Method</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
              {u.createdFrom === 'LMS' ? 'University LMS SSO' : 'Direct Account'}
            </p>
          </div>

          <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">University Tenant</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 truncate">
              {u.tenantName || u.organization || 'Gujarat Technological University'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Account Status</p>
              <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">Active</p>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Identity Sync Status</p>
              <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">LMS Synced</p>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 font-medium">
              <ShieldCheck className="h-3 w-3 mr-1" /> Verified
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
