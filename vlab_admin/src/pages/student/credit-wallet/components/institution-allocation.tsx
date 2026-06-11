import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, GraduationCap, Calendar, Trophy, ChevronRight } from 'lucide-react';

export function InstitutionAllocation() {
  const [open, setOpen] = useState(false);
  
  const allocations = [
    { label: 'College Base Grant', value: 500, icon: Building2, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
    { label: 'Semester Allocation', value: 500, icon: Calendar, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Faculty Awarded', value: 150, icon: GraduationCap, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
    { label: 'Bonus Earned', value: 50, icon: Trophy, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900' },
  ];

  const total = allocations.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <Building2 className="h-5 w-5 text-red-500" /> Institution Allocation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allocations.slice(0, 2).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${item.bg}`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{item.value} <span className="text-[10px] text-slate-500 font-normal">CRD</span></span>
            </div>
          ))}
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full mt-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold uppercase tracking-wider h-8">
                Show More <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="h-5 w-5 text-red-500" /> All Allocations
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-4">
                {allocations.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${item.bg}`}>
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{item.value} <span className="text-xs text-slate-500 font-normal">CRD</span></span>
                  </div>
                ))}
                
                <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center px-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Total Allocated</span>
                  <span className="text-2xl font-extrabold text-red-600">{total} <span className="text-sm text-slate-500 font-bold">CRD</span></span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
