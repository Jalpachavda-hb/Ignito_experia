import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AcademicMilestone } from '../types'
import { CheckCircle2, Circle, Clock } from 'lucide-react'

export function NepTracker({ milestones }: { milestones: AcademicMilestone[] }) {
  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground">NEP Qualification Tracker</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
          {milestones.map((milestone, idx) => {
            const isCompleted = milestone.status === 'Completed'
            const isInProgress = milestone.status === 'In Progress'
            
            return (
              <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-background bg-slate-100 dark:bg-slate-800 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow flex-shrink-0 z-10">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : isInProgress ? (
                    <Clock className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-bold ${isCompleted ? 'text-emerald-600' : isInProgress ? 'text-blue-600' : 'text-slate-500'}`}>
                      {milestone.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{milestone.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
