import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LabActivity as LabActivityType } from '../types'
import { FlaskConical } from 'lucide-react'

export function LabActivity({ labs }: { labs: LabActivityType[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800'
      case 'In Progress': return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800'
      default: return 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800'
    }
  }

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/40 mb-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-md">
            <FlaskConical className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">Recent Lab Activity</CardTitle>
        </div>
        <Badge variant="outline" className="font-normal text-muted-foreground hover:bg-muted cursor-pointer">View All</Badge>
      </CardHeader>
      <CardContent className="flex-1 p-0 px-6 pb-6 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Lab Name</th>
              <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Status</th>
              <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Credits</th>
              <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {labs.map((lab, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{lab.labName}</span>
                    {lab.status === 'In Progress' && (
                      <span className="text-[10px] text-muted-foreground mt-0.5">{lab.completionPercentage}% Completed</span>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${getStatusColor(lab.status)}`}>
                    {lab.status}
                  </Badge>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-xs font-semibold text-foreground">{lab.creditsUsed}</span>
                </td>
                <td className="py-3 text-right">
                  <span className="text-xs text-muted-foreground">{new Date(lab.lastAccessed).toLocaleDateString()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
