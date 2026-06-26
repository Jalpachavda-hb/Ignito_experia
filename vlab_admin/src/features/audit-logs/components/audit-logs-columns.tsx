import { Row, type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { type AuditLog, type AuditAction } from '../data/schema'
import { AuditLogsRowActions } from './audit-logs-row-actions'

const getActionVariant = (action: string) => {
  switch (action) {
    case 'CREATE': return 'default'
    case 'DELETE': return 'destructive'
    case 'UPDATE': return 'secondary'
    case 'LOGIN_FAILED': return 'destructive'
    case 'LOGIN_SUCCESS': return 'default'
    default: return 'outline'
  }
}


export const auditLogsColumns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: 'timestamp',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Timestamp' />
    ),
    cell: ({ row }) => {
      const date = row.original.timestamp
      return (
        <div className='font-mono text-xs text-muted-foreground whitespace-nowrap'>
          {date.toISOString().replace('T', ' ').substring(0, 19)}
        </div>
      )
    },
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'userName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Full Name' />
    ),
    cell: ({ row }) => (
      <span className='font-medium text-sm'>{row.original.user.name}</span>
    ),
  },
  {
    accessorKey: 'userEmail',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>{row.original.user.email}</span>
    ),
  },
  {
    accessorKey: 'action',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Action' />
    ),
    cell: ({ row }) => (
      <Badge variant={getActionVariant(row.original.action)} className="font-mono text-[10px] uppercase tracking-wider">
        {row.original.action}
      </Badge>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'module',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Module' />
    ),
    cell: ({ row }) => (
      <div className='text-sm'>{row.getValue('module')}</div>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Category' />
    ),
    cell: ({ row }) => (
      <div className='text-sm text-muted-foreground'>{row.getValue('category')}</div>
    ),
  },

  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Description' />
    ),
    cell: ({ row }) => (
      <div className='text-sm text-muted-foreground max-w-[200px] truncate' title={row.getValue('description')}>
        {row.getValue('description')}
      </div>
    ),
  },

  {
    id: 'actions',
    cell: ({ row }) => <AuditLogsRowActions row={row} />,
  },
]
