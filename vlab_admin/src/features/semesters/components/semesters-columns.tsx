import { Row, type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { type Semester } from '../data/schema'
import { SemestersRowActions } from './semesters-row-actions'
import { CalendarDays, Users, FlaskConical, Database } from 'lucide-react'

export const semestersColumns: ColumnDef<Semester>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Term' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>{row.getValue('name')}</span>
        <span className='text-xs text-muted-foreground mt-0.5 flex items-center gap-1'>
          <CalendarDays className="h-3 w-3" />
          {row.original.startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'courseName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Course' />
    ),
    cell: ({ row }) => (
      <div className='font-medium text-sm'>{row.getValue('courseName')}</div>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'studentsCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Enrollment' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5 text-sm'>
        <Users className="h-4 w-4 text-muted-foreground" />
        <span>{row.getValue('studentsCount')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'labsAssigned',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Assigned Labs' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5 text-sm'>
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <span>{row.getValue('labsAssigned')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'allocatedCredits',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Credit Pool' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5 text-sm'>
        <Database className="h-4 w-4 text-muted-foreground" />
        <span>{row.getValue('allocatedCredits').toLocaleString()} cr</span>
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
      if (status === 'active') {
        return (
          <Badge variant='outline' className='bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 pr-2'>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            Active
          </Badge>
        )
      }
      if (status === 'upcoming') {
        return <Badge variant='secondary' className='bg-sky-500/10 text-sky-600 hover:bg-sky-500/20'>Upcoming</Badge>
      }
      return <Badge variant='outline'>Completed</Badge>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <SemestersRowActions row={row} />,
  },
]
