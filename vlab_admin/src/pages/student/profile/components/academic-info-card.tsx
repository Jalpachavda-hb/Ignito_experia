import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { BookOpen } from 'lucide-react';

interface AcademicInfoCardProps {
  student: StudentProfile;
}

export function AcademicInfoCard({ student }: AcademicInfoCardProps) {
  const fields = [
    { label: 'Program', value: student.program.name },
    { label: 'Department', value: student.department || 'Not Provided' },
    { label: 'Current Semester', value: `Semester ${student.program.currentSemester}` },
    { label: 'Enrollment Number', value: student.enrollmentNumber },
    { label: 'College Name', value: student.collegeName },
    { label: 'Admission Year', value: student.admissionYear?.toString() || 'Not Provided' },
    { label: 'Expected Graduation Year', value: student.program.expectedEndDate ? new Date(student.program.expectedEndDate).getFullYear().toString() : 'Not Provided' },
    { label: 'Student Type', value: student.studentType || 'Not Provided' },
  ];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" /> Academic Information
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
        </div>
      </CardContent>
    </Card>
  );
}
