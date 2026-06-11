import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { Settings } from 'lucide-react';

interface AccountInfoCardProps {
  student: StudentProfile;
}

export function AccountInfoCard({ student }: AccountInfoCardProps) {
  const fields = [
    { label: 'Student ID', value: student.id },
    { label: 'Username', value: student.username || 'Not Provided' },
    { label: 'Email', value: student.email },
    { label: 'Account Created Date', value: student.accountCreatedDate ? new Date(student.accountCreatedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Provided' },
    { label: 'Last Login', value: student.lastLogin ? new Date(student.lastLogin).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not Provided' },
  ];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 text-indigo-500" /> Account Information
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
          {fields.map((field, idx) => (
            <div key={idx}>
              <p className="text-xs font-medium text-slate-500 mb-1">{field.label}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{field.value}</p>
            </div>
          ))}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Account Status</p>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 mt-1 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
              Active
            </Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Profile Verification Status</p>
            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 mt-1 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900">
              Verified
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
