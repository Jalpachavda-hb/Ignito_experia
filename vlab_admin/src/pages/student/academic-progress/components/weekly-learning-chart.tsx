import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { WeeklyActivityData } from '@/pages/student/dashboard/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CalendarDays } from 'lucide-react';

interface WeeklyLearningChartProps {
  data: WeeklyActivityData[];
}

export function WeeklyLearningChart({ data }: WeeklyLearningChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="border-border/50 shadow-sm h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-500" /> Weekly Learning
          </CardTitle>
          <CardDescription>Study hours and lab activity</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No weekly activity data available.</p>
        </CardContent>
      </Card>
    );
  }

  const totalHours = data.reduce((sum, item) => sum + item.hoursPracticed, 0);

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-500" /> Weekly Learning
            </CardTitle>
            <CardDescription className="font-medium mt-1">
              Study hours and lab activity (Current Week)
            </CardDescription>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalHours.toFixed(1)}h</span>
            <span className="text-xs font-bold text-slate-500">Total Study Time</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              dy={10}
              tickFormatter={(val) => val.substring(0, 3)}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              domain={[0, 'dataMax + 2']}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
              labelStyle={{ color: '#64748b', marginBottom: '4px' }}
            />
            <Area 
              type="monotone" 
              dataKey="hoursPracticed" 
              name="Study Hours"
              stroke="#6366f1" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorHours)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
