import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Award, FileBadge, GraduationCap, Trophy } from 'lucide-react';
import { DashboardData } from '@/pages/student/dashboard/types';

interface CertificationOverviewProps {
  data: DashboardData;
}

export function CertificationOverview({ data }: CertificationOverviewProps) {
  const { certificates, student, milestones } = data;
  
  const totalCertificates = certificates.length;
  const labCertificates = certificates.filter(c => c.type === 'Lab').length;
  const completedAchievements = milestones.filter(m => m.status === 'Completed').length;
  
  const stats = [
    {
      title: "Total Certificates",
      value: totalCertificates.toString(),
      description: `${labCertificates} Lab, ${totalCertificates - labCertificates} Academic`,
      icon: Award,
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-900/20"
    },
    {
      title: "Achievements",
      value: completedAchievements.toString(),
      description: "Milestones Completed",
      icon: Trophy,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      title: "Pending Credentials",
      value: "2", // Mocked for UI purposes
      description: "In Progress / Awaiting Evaluation",
      icon: FileBadge,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      title: "Program Progress",
      value: `${student.program.overallProgress}%`,
      description: "Degree Completion",
      icon: GraduationCap,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i} className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 ${stat.bgColor}`}></div>
          <CardContent className="p-5 flex items-center justify-between relative z-10 h-full">
            <div className="flex flex-col justify-between h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {stat.title}
              </p>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {stat.value}
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                {stat.description}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 shrink-0 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
