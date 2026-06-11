import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, BookOpen, Building2, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function AcademicTransactions() {
  const items = [
    {
      title: 'Semester 3 Allocation',
      description: 'Standard curriculum credit grant',
      credits: 500,
      icon: BookOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      title: 'Faculty Excellence Grant',
      description: 'Awarded by Prof. Sharma',
      credits: 150,
      icon: GraduationCap,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30'
    },
    {
      title: 'Institution Scholarship',
      description: 'Merit-based credit bonus',
      credits: 200,
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100 dark:bg-indigo-900/30'
    },
    {
      title: 'Lab Completion Reward',
      description: 'Completed 5 labs successfully',
      credits: 50,
      icon: Award,
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-900/30'
    }
  ];

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-emerald-500" /> Academic Transactions
        </CardTitle>
        <CardDescription>Credits granted through academic programs.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.title}</h4>
                <p className="text-xs text-slate-500 truncate mt-0.5">{item.description}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold dark:bg-emerald-900/20 dark:border-emerald-900">
                  +{item.credits} CRD
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
