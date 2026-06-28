import {  type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { type Lab } from '../data/schema'
import { LabsRowActions } from './labs-row-actions'

import { Switch } from '@/components/ui/switch'
import { useUpdateLabStatusMutation } from '../data/api'


const StatusCell = ({ lab }: { lab: Lab }) => {
  const updateStatusMutation = useUpdateLabStatusMutation()
  const handleStatusToggle = (checked: boolean) => {
    updateStatusMutation.mutate({
      labId: lab.id,
      status: checked ? 'active' : 'inactive'
    })
  }
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Switch 
        checked={lab.status === 'active'}
        onCheckedChange={handleStatusToggle}
        className="scale-75 origin-left"
      />
      <span className="text-xs text-muted-foreground font-medium">
        {lab.status === 'active' ? '[ ON ] Active' : '[ OFF ] Inactive'}
      </span>
    </div>
  )
}

export const labsColumns: ColumnDef<Lab>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lab Name' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-3'>
        {row.original.logoUrl ? (
          <img src={row.original.logoUrl} alt={row.original.title} className="w-8 h-8 rounded-sm object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {row.original.title.substring(0, 2).toUpperCase()}
          </div>
        )}
        <div className='flex flex-col'>
          <span className='font-medium'>{row.original.title}</span>
          <span className='text-xs text-muted-foreground truncate max-w-[200px]'>
            {row.original.id}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'id',
    header: 'Lab Code',
    enableHiding: true,
  },
  {
    accessorKey: 'runtimeType',
    header: 'Runtime Type',
    enableHiding: true,
  },
  {
    accessorKey: 'program',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Program' />
    ),
    cell: ({ row }) => <div>{row.original.program || 'N/A'}</div>,
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Category' />
    ),
    cell: ({ row }) => {
      return (
        <Badge variant='outline' className='capitalize'>
          {row.getValue('category') || 'Uncategorized'}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'semester',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Semester' />
    ),
    cell: ({ row }) => <div>{row.original.semester || 'N/A'}</div>,
  },
  {
    accessorKey: 'credits',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Credits' />
    ),
    cell: ({ row }) => (
      <div className='font-mono font-medium'>
        {Intl.NumberFormat('en-US').format(row.getValue('credits') || 0)}
      </div>
    ),
  },
  {
    accessorKey: 'durationMinutes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Duration' />
    ),
    cell: ({ row }) => {
      const mins = (row.getValue('durationMinutes') as number) || 0
      return <div>{mins} Minutes</div>
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => <StatusCell lab={row.original} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <LabsRowActions row={row} />,
  },
]



