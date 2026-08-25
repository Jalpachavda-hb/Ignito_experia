import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { User, Pencil } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { EditProfileModal } from './edit-profile-modal';

interface PersonalInfoCardProps {
  student: StudentProfile;
}

export function PersonalInfoCard({ student }: PersonalInfoCardProps) {
  const { auth } = useAuthStore();
  const u: any = auth.user || {};
  const isDirectUser = Boolean(
    u.createdFrom === 'DIRECT' || 
    (u.authType === 'DIRECT' && !u.studentDegreeAdmissionId && !u.externalStudentId && u.createdFrom !== 'LMS')
  );

  const [showEditModal, setShowEditModal] = useState(false);

  const fields = isDirectUser
    ? [
        { label: 'Full Name', value: u.fullName || u.name || student.name },
        { label: 'Email Address', value: u.email || student.email },
        { label: 'Mobile Number', value: u.mobile || u.phoneNumber || student.mobile || 'Not Provided' },
      ]
    : [
        { label: 'Full Name', value: u.fullName || u.name || student.name },
        { label: 'Email Address', value: u.email || student.email },
        { label: 'Gender', value: u.gender || 'Not Provided' },
        { label: 'Date of Birth', value: u.dateOfBirth || 'Not Provided' },
        { label: 'Mobile Number', value: u.mobile || u.phoneNumber || student.mobile || 'Not Provided' },
        { label: 'Alternate Contact', value: u.alternateMobile || 'Not Provided' },
      ];

  return (
    <>
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-card h-full flex flex-col justify-between">
        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 shrink-0 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <User className="h-4 w-4 text-slate-500" /> Personal Information
          </CardTitle>
          {isDirectUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <Pencil className="h-3.5 w-3.5 text-slate-500" /> Edit Profile
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
            {fields.map((field, idx) => (
              <div key={idx} className="border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{field.label}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 truncate">
                  {field.value}
                </p>
              </div>
            ))}
          </div>

          {!isDirectUser && (
            <div className="pt-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Address</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 leading-relaxed">
                {u.address || 'Not Provided'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isDirectUser && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          initialName={u.fullName || u.name || student.name || ''}
          initialMobile={u.mobile || u.phoneNumber || student.mobile || ''}
          email={u.email || student.email || ''}
        />
      )}
    </>
  );
}
