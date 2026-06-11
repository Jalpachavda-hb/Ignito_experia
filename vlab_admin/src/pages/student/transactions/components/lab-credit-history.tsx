import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TerminalSquare, PlayCircle, CheckCircle2, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LabActivity {
  id: string;
  labName: string;
  creditsUsed: number;
  status: string;
  completionPercentage: number;
}

interface LabCreditHistoryProps {
  recentLabs: LabActivity[];
}

export function LabCreditHistory({ recentLabs }: LabCreditHistoryProps) {
  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <TerminalSquare className="h-5 w-5 text-indigo-500" /> Lab Credit History
        </CardTitle>
        <CardDescription>Credit consumption per lab session.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentLabs.length > 0 ? (
            recentLabs.map(lab => (
              <div key={lab.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">{lab.labName}</h4>
                  <span className="font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap ml-2">-{lab.creditsUsed} CRD</span>
                </div>
                
                <div className="flex items-center gap-4 text-xs mt-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    {lab.status === 'Completed' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : lab.status === 'In Progress' ? (
                      <PlayCircle className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{lab.status}</span>
                  </div>
                  
                  <div className="flex-1 flex items-center gap-2">
                    <Progress value={lab.completionPercentage} className="h-1.5" />
                    <span className="text-slate-500 min-w-[30px]">{lab.completionPercentage}%</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-slate-500 text-sm border border-dashed rounded-xl">
              No lab history found.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
