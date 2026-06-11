import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SemesterPerformanceData } from '@/pages/student/dashboard/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface PerformanceChartProps {
  data: SemesterPerformanceData[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  // If data is empty or missing, provide a fallback or empty state
  if (!data || data.length === 0) {
    return (
      <Card className="border-border/50 shadow-sm h-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-rose-500" /> Academic Performance
          </CardTitle>
          <CardDescription>Semester over semester average marks</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No performance data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const currentAverage = data[data.length - 1]?.averageMarks || 0;
  const previousAverage = data.length > 1 ? data[data.length - 2]?.averageMarks : 0;
  const trend = previousAverage > 0 ? ((currentAverage - previousAverage) / previousAverage) * 100 : 0;

  return (
    <Card className="border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-rose-500" /> Academic Performance
            </CardTitle>
            <CardDescription className="font-medium mt-1">
              Semester over semester average marks
            </CardDescription>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{currentAverage}%</span>
            <span className={`text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% from last sem
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="semester" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#64748b' }} 
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
              labelStyle={{ color: '#64748b', marginBottom: '4px' }}
            />
            <Line 
              type="monotone" 
              dataKey="averageMarks" 
              name="Average Marks %"
              stroke="#e11d48" 
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#e11d48' }}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#e11d48' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
