import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, Database, CalendarCheck, Trophy, Clock } from 'lucide-react'
import { DashboardData } from '../types'

export function StatsCards({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
      
      {/* 1. Current CGPA */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Current CGPA</CardTitle>
          <GraduationCap className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex items-baseline gap-1">
             <span className="text-2xl font-bold text-red-600 dark:text-red-400">{data.currentGPA}</span>
             <span className="text-sm font-semibold text-muted-foreground">/10.0</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Great performance!
          </p>
        </CardContent>
      </Card>

      {/* 2. Available Credits */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
          <Database className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex items-baseline gap-1">
             <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{data.wallet.remainingCredits}</span>
             <span className="text-sm font-semibold text-muted-foreground">/{data.wallet.totalCredits}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Active credits
          </p>
        </CardContent>
      </Card>

      {/* 3. Used Credits */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Used Credits</CardTitle>
          <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.wallet.usedCredits}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Credits consumed
          </p>
        </CardContent>
      </Card>

      {/* 4. Attendance */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Attendance</CardTitle>
          <CalendarCheck className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.attendancePercentage}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            Consistent presence
          </p>
        </CardContent>
      </Card>

      {/* 5. Academic Rank */}
      <Card className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">Academic Rank</CardTitle>
          <Trophy className="h-4 w-4 text-indigo-500" />
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Top 15%</div>
          <p className="text-xs text-muted-foreground mt-1">
            Batch percentile
          </p>
        </CardContent>
      </Card>

    </div>
  )
}
