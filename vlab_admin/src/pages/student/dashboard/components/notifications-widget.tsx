import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Notification } from '../types'
import { Bell, FlaskConical, Wallet, Award, BookOpen } from 'lucide-react'

export function NotificationsWidget({ notifications }: { notifications: Notification[] }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'Lab': return <FlaskConical className="h-4 w-4 text-blue-500" />
      case 'Credit': return <Wallet className="h-4 w-4 text-emerald-500" />
      case 'Certificate': return <Award className="h-4 w-4 text-rose-500" />
      default: return <BookOpen className="h-4 w-4 text-indigo-500" />
    }
  }

  const getBgColor = (type: string) => {
    switch (type) {
      case 'Lab': return 'bg-blue-100 dark:bg-blue-900/30'
      case 'Credit': return 'bg-emerald-100 dark:bg-emerald-900/30'
      case 'Certificate': return 'bg-rose-100 dark:bg-rose-900/30'
      default: return 'bg-indigo-100 dark:bg-indigo-900/30'
    }
  }

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <div className="h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">
          {notifications.filter(n => !n.isRead).length}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="flex gap-3 items-start relative group">
              {!notification.isRead && (
                <div className="absolute top-1.5 -left-1.5 h-2 w-2 rounded-full bg-rose-500" />
              )}
              <div className={`mt-0.5 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${getBgColor(notification.type)}`}>
                {getIcon(notification.type)}
              </div>
              <div>
                <h4 className={`text-sm font-semibold ${notification.isRead ? 'text-foreground/80' : 'text-foreground'}`}>
                  {notification.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                <p className="text-[10px] text-muted-foreground/80 mt-1">{new Date(notification.date).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
