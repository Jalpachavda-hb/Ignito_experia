import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { User } from 'lucide-react';

interface PersonalInfoCardProps {
  student: StudentProfile;
}

export function PersonalInfoCard({ student }: PersonalInfoCardProps) {
  const fields = [
    { label: 'Full Name', value: student.name },
    { label: 'Gender', value: student.gender || 'Not Provided' },
    { label: 'Date of Birth', value: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not Provided' },
    { label: 'Email Address', value: student.email },
    { label: 'Mobile Number', value: student.mobile },
    { label: 'Alternate Contact', value: student.alternateMobile || 'Not Provided' },
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
              {student.address ? `${student.address}, ${student.city}, ${student.state}, ${student.country}` : 'Not Provided'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
