import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTransactionStore } from '@/stores/transactionStore';

export function AcademicTransactions() {
  const { transactions } = useTransactionStore();

  // Filter ONLY System Allocations / Scholarships / Academic Grants
  const academicItems = transactions.filter(
    (t) =>
      t.paymentMethod === 'System Allocation' ||
      t.paymentMethod === 'Scholarship' ||
      t.paymentMethod === 'Academic Grant' ||
      t.description.toLowerCase().includes('semester') ||
      t.description.toLowerCase().includes('grant') ||
      t.description.toLowerCase().includes('bonus')
  );

  return (
    <Card className="border-border/50 shadow-sm h-full rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-emerald-500" /> Academic Grants & Grants
        </CardTitle>
        <CardDescription>Curriculum grants, faculty awards, and semester credit allocations.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {academicItems.length > 0 ? (
            academicItems.slice(0, 5).map((item, idx) => (
              <div key={item.id || idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.description}</h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.paymentMethod || 'Academic Grant'} &bull; {new Date(item.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px]">
                    +{item.amount} CRD
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center">
              <GraduationCap className="h-8 w-8 text-slate-300 mb-2" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">No academic credit grants found.</span>
              <span className="text-xs text-slate-400 mt-1">Semester allocations and faculty grants will appear here when issued.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
