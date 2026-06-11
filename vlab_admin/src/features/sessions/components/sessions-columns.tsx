import { Row, type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { type Session } from '../data/schema'
import { SessionsRowActions } from './sessions-row-actions'
import { Activity, Clock } from 'lucide-react'

// Helper to determine color based on usage %
const getUsageColor = (usage: number) => {
  if (usage > 85) return 'bg-rose-500' // Critical
  if (usage > 60) return 'bg-amber-500' // Warning
  return 'bg-emerald-500' // Healthy
}

export const sessionsColumns: ColumnDef<Session>[] = [
  {
    accessorKey: 'userName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='User' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>{row.getValue('userName')}</span>
        <span className='text-xs text-muted-foreground'>
          {row.original.userEmail}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'labName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lab Instance' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium truncate max-w-[180px]' title={row.getValue('labName')}>
          {row.getValue('labName')}
        </span>
        <span className='text-xs text-muted-foreground'>
          Course: {row.original.course}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      if (status === 'running') {
        return (
          <Badge variant='outline' className='bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 pr-2'>
            <Activity className="h-3 w-3 animate-pulse" />
            Running
          </Badge>
        )
      }
      if (status === 'stopped') {
        return (
          <Badge variant='outline' className='bg-muted text-muted-foreground gap-1'>
            Stopped
          </Badge>
        )
      }
      return (
        <Badge variant='destructive' className='gap-1'>
          Failed
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'cpuUsage',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='CPU Usage' />
    ),
    cell: ({ row }) => {
      const usage = row.getValue('cpuUsage') as number
      const status = row.original.status
      if (status !== 'running') return <span className="text-muted-foreground text-xs">-</span>
      
      return (
        <div className='flex flex-col gap-1 w-[100px]'>
          <div className="flex justify-between text-[10px] font-mono">
            <span>CPU</span>
            <span className={usage > 85 ? 'text-rose-500 font-bold' : ''}>{usage}%</span>
          </div>
          <Progress value={usage} indicatorColor={getUsageColor(usage)} className="h-1.5" />
        </div>
      )
    },
  },
  {
    accessorKey: 'ramUsage',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='RAM Usage' />
    ),
    cell: ({ row }) => {
      const usage = row.getValue('ramUsage') as number
      const status = row.original.status
      if (status !== 'running') return <span className="text-muted-foreground text-xs">-</span>
      
      return (
        <div className='flex flex-col gap-1 w-[100px]'>
          <div className="flex justify-between text-[10px] font-mono">
            <span>MEM</span>
            <span className={usage > 85 ? 'text-rose-500 font-bold' : ''}>{usage}%</span>
          </div>
          <Progress value={usage} indicatorColor={getUsageColor(usage)} className="h-1.5" />
        </div>
      )
    },
  },
  {
    accessorKey: 'startTime',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Uptime / Duration' />
    ),
    cell: ({ row }) => {
      const start = row.getValue('startTime') as Date
      const end = row.original.endTime
      const now = new Date()
      
      let durationStr = ''
      if (end) {
        // Stopped/Failed
        const diffMins = Math.floor((end.getTime() - start.getTime()) / 60000)
        durationStr = `${diffMins}m (Ended)`
      } else {
        // Running
        const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000)
        const hrs = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
      }

      return (
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className={!end ? "font-medium" : "text-muted-foreground"}>{durationStr}</span>
            <span className="text-[10px] text-muted-foreground">
              Since {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <SessionsRowActions row={row} />,
  },
]
