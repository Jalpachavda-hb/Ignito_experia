import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Wallet, ClipboardList, Award } from 'lucide-react'

export function RecentActivityTimeline() {
  
  const activities = [
    {
      id: 1,
      title: 'Lab 14 - Data Structures',
      subtitle: 'Completed Successfully',
      time: 'Today, 10:30 AM',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50'
    },
    {
      id: 2,
      title: 'Credits Added',
      subtitle: '+50 Credits',
      time: 'Yesterday, 4:15 PM',
      icon: Wallet,
      color: 'text-orange-500',
      bg: 'bg-orange-50'
    },
    {
      id: 3,
      title: 'Assignment Submitted',
      subtitle: 'DBMS Assignment 2',
      time: 'Yesterday, 2:20 PM',
      icon: ClipboardList,
      color: 'text-red-500',
      bg: 'bg-red-50'
    },
    {
      id: 4,
      title: 'Certificate Earned',
      subtitle: 'Python Essentials',
      time: '2 days ago',
      icon: Award,
      color: 'text-purple-500',
      bg: 'bg-purple-50'
    }
  ]

  return (
    <Card className="border-border/60 shadow-sm rounded-xl">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-foreground">Recent Activity</CardTitle>
        <Button variant="outline" size="sm" className="h-8 text-[11px] px-4 rounded-lg font-semibold border-border/60">
          View All Activity
        </Button>
      </CardHeader>
      <CardContent className="pb-8 pt-4">
        
        <div className="relative flex justify-between items-start w-full">
          {/* Connecting Line */}
          <div className="absolute top-6 left-12 right-12 h-[2px] border-t-2 border-dashed border-border/60 -z-10" />

          {activities.map((activity, idx) => (
            <div key={activity.id} className="flex flex-col items-center flex-1 relative bg-white dark:bg-card px-2">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 ${activity.bg} ${activity.color} shadow-sm border border-white dark:border-card`}>
                <activity.icon className="h-6 w-6" />
              </div>
              <h4 className="text-[11px] font-bold text-foreground text-center mb-1">{activity.title}</h4>
              <p className="text-[10px] font-medium text-muted-foreground text-center mb-1">{activity.subtitle}</p>
              <p className="text-[9px] text-muted-foreground/70 text-center">{activity.time}</p>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  )
}
