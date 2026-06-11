import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WeeklyActivityData } from '../types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { CalendarDays } from 'lucide-react'

export function PerformanceCharts({ 
  weeklyActivity
}: { 
  weeklyActivity: WeeklyActivityData[]
}) {
  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col rounded-xl">
      <CardHeader className="pb-2 border-b border-border/40 mb-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-md">
            <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">Weekly Learning Activity</CardTitle>
        </div>
        <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          Hours Practiced
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[250px]">
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area 
                type="monotone" 
                dataKey="hoursPracticed" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorHours)" 
                name="Hours"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
