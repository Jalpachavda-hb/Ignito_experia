import { Row, type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { type Course } from '../data/schema'
import { CoursesRowActions } from './courses-row-actions'
import { GraduationCap, Users, FlaskConical } from 'lucide-react'

export const coursesColumns: ColumnDef<Course>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Course Details' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium text-primary'>{row.getValue('name')}</span>
        <span className='text-xs text-muted-foreground font-mono mt-0.5'>
          {row.original.code}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'program',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Program' />
    ),
    cell: ({ row }) => (
      <Badge variant='secondary' className='gap-1 font-normal'>
        <GraduationCap className="h-3 w-3 text-muted-foreground" />
        {row.getValue('program')}
      </Badge>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'totalSemesters',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Semesters' />
    ),
    cell: ({ row }) => (
      <div className='text-sm'>
        {row.getValue('totalSemesters')} Term{row.original.totalSemesters > 1 ? 's' : ''}
      </div>
    ),
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
        <span>{row.getValue('labsAssigned')} Labs</span>
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
        return <Badge variant='default'>Active</Badge>
      }
      if (status === 'draft') {
        return <Badge variant='secondary'>Draft</Badge>
      }
      return <Badge variant='outline'>Archived</Badge>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <CoursesRowActions row={row} />,
  },
]
