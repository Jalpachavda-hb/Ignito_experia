import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Layers, PlayCircle, CheckCircle2, Clock } from 'lucide-react';
import { Lab } from '../types';

export function MyLabsHeader({ labs }: { labs: Lab[] }) {
  const totalLabs = labs.length;
  const completedLabs = labs.filter(l => l.status === 'Completed').length;
  const inProgressLabs = labs.filter(l => l.status === 'In Progress' || l.status === 'active').length;
  const pendingLabs = labs.filter(l => l.status === 'Not Started' || !l.status).length;

  const stats = [
    {
      title: 'Total Labs',
      value: totalLabs,
      icon: Layers,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'In Progress',
      value: inProgressLabs,
      icon: PlayCircle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      title: 'Completed',
      value: completedLabs,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Pending',
      value: pendingLabs,
      icon: Clock,
      color: 'text-slate-500',
      bg: 'bg-slate-500/10',
    },
  ];

  return (
    <div className="mb-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Labs</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-2xl">
          Access, launch, monitor and track your virtual laboratory environments. Continue where you left off or start a new lab challenge.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 ${stat.bg}`}></div>
            <CardContent className="p-5 flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {stat.title}
                </p>
                <div className="text-3xl font-bold tracking-tight">
                  {stat.value}
                </div>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm bg-white dark:bg-slate-900 border border-border/50 ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
