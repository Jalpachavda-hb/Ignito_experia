import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, PlayCircle } from 'lucide-react';

interface LabActivity {
  id: string;
  labName: string;
  status: string;
  creditsUsed: number;
}

interface ActiveConsumersProps {
  recentLabs: LabActivity[];
}

export function ActiveConsumers({ recentLabs }: ActiveConsumersProps) {
  const activeLabs = recentLabs.filter(lab => lab.status === 'In Progress' || lab.status === 'active');

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-500" /> Active Credit Consumers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeLabs.length > 0 ? (
          <div className="space-y-4">
            {activeLabs.map(lab => (
              <div key={lab.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">{lab.labName}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                      -{lab.creditsUsed} CRD
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Session Active
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 gap-1 h-8 text-xs font-semibold">
                  <PlayCircle className="h-3.5 w-3.5 text-slate-500" /> Resume
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Activity className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No active lab sessions.</p>
            <p className="text-xs text-slate-500 mt-1">Labs currently in progress will appear here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
