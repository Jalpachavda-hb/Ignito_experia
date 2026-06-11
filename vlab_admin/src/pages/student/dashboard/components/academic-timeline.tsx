import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgramInfo } from '../types'
import { CheckCircle2, CircleDot, Circle } from 'lucide-react'

export function AcademicTimeline({ program }: { program: ProgramInfo }) {
  const semesters = Array.from({ length: program.totalSemesters }).map((_, i) => i + 1)

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">Academic Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {semesters.map((sem) => {
            const isCompleted = sem < program.currentSemester
            const isCurrent = sem === program.currentSemester

            return (
              <div key={sem} className="relative">
                <div className="absolute -left-[35px] mt-1 bg-white dark:bg-background">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 bg-white dark:bg-background" />
                  ) : isCurrent ? (
                    <CircleDot className="h-5 w-5 text-blue-500 bg-white dark:bg-background" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 dark:text-slate-700 bg-white dark:bg-background" />
                  )}
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-500' : isCurrent ? 'text-blue-600 dark:text-blue-500' : 'text-slate-500'}`}>
                    Semester {sem}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isCompleted ? 'Completed' : isCurrent ? 'Current Semester' : 'Upcoming'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
