import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StudentProfile } from '@/pages/student/dashboard/types';
import { CheckCircle2, GraduationCap, UserCheck, Shield, Mail } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { BASE_URL } from '@/Utils/Api_path';
import { isDirectStudent } from '@/lib/student-kind';

const getProfileImgUrl = (imgUrl: string | null | undefined) => {
  if (!imgUrl) return null;
  if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
    return imgUrl;
  }
  const backendOrigin = BASE_URL.replace(/\/api\/?$/, '');
  return `${backendOrigin}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
};

interface ProfileSummaryCardProps {
  student: StudentProfile;
}

export function ProfileSummaryCard({ student }: ProfileSummaryCardProps) {
  const { auth } = useAuthStore();
  const u: any = auth.user || {};

  const name = u.fullName || u.name || 'Student';
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'ST';

  const programmes = Array.isArray(u.programmesList) ? u.programmesList : [];
  const enrollment = u.enrollmentNumber || u.studentCode || programmes[0]?.enrollmentNumber || null;
  const college = u.collegeName || u.tenantName || u.organization || null;
  const isDirectUser = isDirectStudent(u);
  const rawImg = u.profileImage || u.ProfileImage || u.avatar || u.studentProfileImage || null;
  const profileImg = getProfileImgUrl(rawImg);

  return (
    <Card className="border border-border/70 shadow-xs rounded-xl overflow-hidden bg-card">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-6">

          {/* Left Block: Avatar + Name + Email + Badges */}
          <div className="flex flex-col md:flex-row items-center md:items-center gap-6 text-center md:text-left">
            
            {/* Clean Minimalist Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border border-border/80 bg-slate-100 dark:bg-slate-900 shadow-xs overflow-hidden relative flex items-center justify-center">
                <div className="w-full h-full font-bold text-2xl md:text-3xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 flex items-center justify-center absolute inset-0 z-0">
                  {initials}
                </div>
                {profileImg ? (
                  <img
                    src={profileImg}
                    alt={name}
                    className="w-full h-full object-cover relative z-10"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
              </div>
            </div>

            {/* Student Identity Information */}
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                {name}
              </h2>
              <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-muted-foreground font-medium">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{u.email}</span>
                {enrollment && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">ID: {enrollment}</span>
                  </>
                )}
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-0.5">
                {isDirectUser ? (
                  <Badge variant="outline" className="bg-amber-50/60 text-amber-700 border-amber-200/80 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/60 font-medium px-2.5 py-0.5 rounded-full text-xs">
                    <UserCheck className="h-3 w-3 mr-1.5" /> Experia User
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-blue-50/60 text-blue-700 border-blue-200/80 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/60 font-medium px-2.5 py-0.5 rounded-full text-xs">
                    <Shield className="h-3 w-3 mr-1.5" /> University LMS Account
                  </Badge>
                )}
                <Badge variant="outline" className="bg-emerald-50/60 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/60 font-medium px-2.5 py-0.5 rounded-full text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1.5" /> Active Account
                </Badge>
              </div>
            </div>

          </div>

          {/* Right Block: LMS Academic Info (if LMS student) */}
          {programmes.length > 0 && !isDirectUser ? (
            <div className="w-full md:w-auto bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-border/70 flex items-start gap-3 shrink-0">
              <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="text-left space-y-2">
                {programmes.map((prog: any, idx: number) => (
                  <div key={idx}>
                    <h4 className="text-xs font-bold text-foreground leading-tight">
                      {prog.programmeName || prog.programName}
                    </h4>
                    {prog.currentSemester != null && prog.currentSemester !== '' ? (
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                        Semester {prog.currentSemester}
                      </p>
                    ) : null}
                  </div>
                ))}
                {college ? (
                  <p className="text-[11px] text-muted-foreground">{college}</p>
                ) : null}
              </div>
            </div>
          ) : null}

        </div>
      </CardContent>
    </Card>
  );
}
