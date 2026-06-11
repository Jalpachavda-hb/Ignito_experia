import { Row, type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { type Lab } from '../data/schema'
import { LabsRowActions } from './labs-row-actions'

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
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lab Name' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>{row.getValue('name')}</span>
        <span className='text-xs text-muted-foreground truncate max-w-[200px]'>
          {row.original.dockerImage}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Category' />
    ),
    cell: ({ row }) => {
      return (
        <Badge variant='outline' className='capitalize'>
          {row.getValue('category')}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'technologies',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Technologies' />
    ),
    cell: ({ row }) => {
      const tags = row.original.technologies
      return (
        <div className='flex flex-wrap gap-1 max-w-[200px]'>
          {tags.slice(0, 3).map((tag, i) => (
            <Badge key={i} variant='secondary' className='text-[10px] px-1 py-0 h-4'>
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <span className='text-xs text-muted-foreground'>+{tags.length - 3}</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'creditCost',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Cost' />
    ),
    cell: ({ row }) => (
      <div className='font-mono font-medium'>
        {Intl.NumberFormat('en-US').format(row.getValue('creditCost'))}
      </div>
    ),
  },
  {
    accessorKey: 'durationMinutes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Duration' />
    ),
    cell: ({ row }) => {
      const mins = row.getValue('durationMinutes') as number
      const hrs = Math.floor(mins / 60)
      const rMins = mins % 60
      const display = hrs > 0 ? `${hrs}h ${rMins > 0 ? rMins + 'm' : ''}` : `${mins}m`
      return <div>{display}</div>
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      let variant: 'default' | 'secondary' | 'destructive' = 'default'
      if (status === 'maintenance') variant = 'secondary'
      if (status === 'deprecated') variant = 'destructive'
      return (
        <Badge variant={variant} className='capitalize'>
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <LabsRowActions row={row} />,
  },
]
