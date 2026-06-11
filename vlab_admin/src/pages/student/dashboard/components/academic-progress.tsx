import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgramInfo } from '../types'
import { ChevronDown, ArrowUp, Minus } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'

export function AcademicProgress({ 
  program,
  stats
}: { 
  program: ProgramInfo,
  stats: { completedLabs: number, inProgressLabs: number, pendingLabs: number, totalLabs: number }
}) {
  const chartData = [
    { name: 'Completed', value: stats.completedLabs, color: '#ef4444' }, // Red
    { name: 'In Progress', value: stats.inProgressLabs, color: '#f97316' }, // Orange
    { name: 'Pending', value: stats.pendingLabs, color: '#f1f5f9' } // Gray
  ]

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col rounded-xl">
      <CardHeader className="pb-0 mb-6 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-foreground">Academic Overview</CardTitle>
        <Button variant="outline" size="sm" className="h-8 text-xs px-3 rounded-lg flex items-center gap-1 border-border/60">
          This Semester <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-between px-6 pb-6">
        
        {/* Circular Progress Chart */}
        <div className="relative h-[160px] w-[160px] shrink-0 mr-8">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span className="text-3xl font-bold text-foreground">{program.overallProgress}%</span>
            <span className="text-[10px] font-semibold text-muted-foreground mt-1">Overall Progress</span>
          </div>
        </div>

        {/* Stats List */}
        <div className="flex-1 space-y-5">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-3 w-32">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="font-semibold text-foreground text-xs">Completed Labs</span>
            </div>
            <span className="font-bold text-sm">{stats.completedLabs}</span>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500 w-24 justify-end">
              <ArrowUp className="h-3 w-3" /> 2 this week
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-3 w-32">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="font-semibold text-foreground text-xs">In Progress</span>
            </div>
            <span className="font-bold text-sm">{stats.inProgressLabs}</span>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-orange-500 w-24 justify-end">
              <ArrowUp className="h-3 w-3" /> 1 this week
            </div>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-3 w-32">
              <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="font-semibold text-foreground text-xs">Not Started</span>
            </div>
            <span className="font-bold text-sm">{stats.pendingLabs}</span>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground w-24 justify-end">
               <Minus className="h-3 w-3" />
            </div>
          </div>
          
          <div className="pt-4 flex justify-between items-center text-sm">
            <div className="w-32 pl-5">
              <span className="font-semibold text-foreground text-xs">Total Labs</span>
            </div>
            <span className="font-bold text-foreground text-sm pl-1">{stats.totalLabs}</span>
            <div className="w-24"></div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
