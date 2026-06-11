import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Target, Lock, PlayCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface UpcomingCertificatesProps {
  data: DashboardData;
}

export function UpcomingCertificates({ data }: UpcomingCertificatesProps) {
  const { recentLabs, milestones } = data;
  
  // Extract upcoming certificates based on incomplete labs and pending milestones
  const upcoming = [
    { 
      title: "Advanced Data Structures Lab", 
      type: "Lab Certificate", 
      progress: recentLabs.find(l => l.labName.includes('Data Structures'))?.completionPercentage || 40,
      req: "Complete 3 remaining assignments"
    },
    { 
      title: "Semester 3 Completion", 
      type: "Academic Certificate", 
      progress: 75,
      req: "Pass all current subjects"
    },
    { 
      title: "Web Development Mastery", 
      type: "Skill Badge", 
      progress: 10,
      req: "Complete React and Node.js labs"
    }
  ];

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-500" /> Upcoming Certificates
        </CardTitle>
        <CardDescription className="font-medium mt-1">
          Credentials currently in progress
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex-1">
        <div className="space-y-5">
          {upcoming.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {item.progress > 0 ? <PlayCircle className="h-4 w-4 text-indigo-500" /> : <Lock className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-none">{item.title}</h4>
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-1">{item.type}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="h-1.5 bg-slate-100 dark:bg-slate-800" indicatorClassName="bg-indigo-500" />
              <p className="text-xs text-slate-500 italic flex items-center gap-1.5 before:content-[''] before:block before:w-1 before:h-1 before:rounded-full before:bg-slate-300 dark:before:bg-slate-600">
                {item.req}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
