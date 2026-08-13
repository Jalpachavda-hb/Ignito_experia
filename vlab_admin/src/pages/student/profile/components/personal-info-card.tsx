import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface PersonalInfoCardProps {
  student: StudentProfile;
}

export function PersonalInfoCard({ student }: PersonalInfoCardProps) {
  const { auth } = useAuthStore();
  const u = auth.user || {};

  const fields = [
    { label: 'Full Name', value: u.fullName || u.name || student.name },
    { label: 'Admission ID', value: u.studentDegreeAdmissionId || '1' },
    { label: 'Gender', value: u.gender || 'Not Provided' },
    { label: 'Date of Birth', value: u.dateOfBirth || 'Not Provided' },
    { label: 'Email Address', value: u.email || student.email },
    { label: 'Mobile Number', value: u.mobile || 'Not Provided' },
    { label: 'Alternate Contact', value: u.alternateMobile || 'Not Provided' },
  ];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <User className="h-5 w-5 text-red-500" /> Personal Information
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
          <div className="md:col-span-2">
            <p className="text-xs font-medium text-slate-500 mb-1">Address</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {u.address || 'Not Provided'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
