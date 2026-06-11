import { Row, type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { type Program } from '../data/schema'
import { ProgramsRowActions } from './programs-row-actions'
import { GraduationCap, Users, FlaskConical, BookOpen } from 'lucide-react'

export const programsColumns: ColumnDef<Program>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Program Name' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>{row.getValue('name')}</span>
        <span className='text-xs text-muted-foreground mt-0.5 font-mono'>{row.original.code}</span>
      </div>
    ),
  },
  {
    accessorKey: 'degree',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Degree' />
    ),
    cell: ({ row }) => (
      <Badge variant='secondary' className='gap-1 font-normal'>
        <GraduationCap className="h-3 w-3 text-muted-foreground" />
        {row.getValue('degree')}
      </Badge>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'durationYears',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Duration' />
    ),
    cell: ({ row }) => (
      <div className='text-sm'>{row.getValue('durationYears')} Years</div>
    ),
  },
  {
    accessorKey: 'totalCourses',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Courses' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5 text-sm'>
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <span>{row.getValue('totalCourses')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'totalStudents',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Enrollment' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5 text-sm'>
        <Users className="h-4 w-4 text-muted-foreground" />
        <span>{row.getValue('totalStudents').toLocaleString()}</span>
      </div>
    ),
  },
  {
    accessorKey: 'totalLabs',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Total Labs' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5 text-sm'>
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <span>{row.getValue('totalLabs')}</span>
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
      return <Badge variant='outline'>Inactive</Badge>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <ProgramsRowActions row={row} />,
  },
]
