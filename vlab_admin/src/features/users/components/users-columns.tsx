import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { roles } from '../data/data'
import { type User } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const usersColumns: ColumnDef<User>[] = [
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
        className='translate-y-0.5'
      />
    ),
    meta: {
      className: cn('inset-s-0 z-10 rounded-tl-[inherit] max-md:sticky'),
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-0.5'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'FullName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-36 ps-3'>{row.getValue('FullName')}</LongText>
    ),
    meta: {
      className: cn(
        'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)]',
        'inset-s-6 ps-0.5 max-md:sticky @4xl/content:table-cell @4xl/content:drop-shadow-none'
      ),
    },
  },
  {
    accessorKey: 'Email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => (
      <div className='w-fit ps-2 text-nowrap'>{row.getValue('Email')}</div>
    ),
  },
  {
    accessorKey: 'PhoneNumber',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Phone Number' />
    ),
    cell: ({ row }) => <div>{row.getValue('PhoneNumber') || '-'}</div>,
    enableSorting: false,
  },
  {
    accessorKey: 'Role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Role' />
    ),
    cell: ({ row }) => {
      const roleValue = row.getValue('Role') as string;
      const userType = roles.find(({ value }) => value.toLowerCase() === roleValue.toLowerCase())

      if (!userType) {
        return <span className='text-sm capitalize'>{roleValue}</span>
      }

      return (
        <div className='flex items-center gap-x-2'>
          {userType.icon && (
            <userType.icon size={16} className='text-muted-foreground' />
          )}
          <span className='text-sm capitalize'>{roleValue}</span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'EnrollmentNumber',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Enrollment No.' />
    ),
    cell: ({ row }) => <div className="font-mono text-xs font-semibold">{row.getValue('EnrollmentNumber') || '-'}</div>,
  },
  {
    accessorKey: 'ProgramId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Program' />
    ),
    cell: ({ row }) => <div>{row.getValue('ProgramId') || '-'}</div>,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'SemesterId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Semester' />
    ),
    cell: ({ row }) => <div>{row.getValue('SemesterId') || '-'}</div>,
  },
  {
    accessorKey: 'CreditBalance',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Credits' />
    ),
    cell: ({ row }) => {
      const credits = row.getValue('CreditBalance') as string | number;
      const parsedCredits = typeof credits === 'string' ? parseFloat(credits) : credits;
      return (
        <div className='font-medium text-amber-600 dark:text-amber-500'>
          {isNaN(parsedCredits) ? '-' : Intl.NumberFormat('en-US').format(parsedCredits)}
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
