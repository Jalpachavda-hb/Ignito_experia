import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
}

export function StatsCard({ title, value, description, icon: Icon }: StatsCardProps) {
  return (
    <Card className="border border-border/60 shadow-sm bg-card">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <h3 className="text-xl font-bold text-foreground mt-1">{value}</h3>
          {description && <p className="text-xs text-muted-foreground/80 mt-0.5">{description}</p>}
        </div>
        {Icon && (
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
