import { useState, useEffect } from 'react'
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { type Lab } from '../data/schema'
import { labsColumns as activeColumns, deletedLabsColumns } from './labs-columns'

type DataTableProps = {
  data: Lab[]
  isDeletedTab?: boolean
}

export function LabsTable({ data, isDeletedTab }: DataTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = isDeletedTab ? deletedLabsColumns : activeColumns

  const programs = Array.from(new Set(data.map(l => l.program).filter(Boolean)))
  const semesters = Array.from(new Set(data.map(l => l.semester).filter(Boolean)))
  const runtimeTypes = Array.from(new Set(data.map(l => l.runtimeType).filter(Boolean)))
  const credits = Array.from(new Set(data.map(l => l.credits).filter(c => c !== undefined && c !== null)))
  const durations = Array.from(new Set(data.map(l => l.durationMinutes).filter(d => d !== undefined && d !== null)))

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase()
      const title = (row.original.title || '').toLowerCase()
      const code = (row.original.id || '').toLowerCase()
      const program = (row.original.program || '').toLowerCase()
      const semester = (row.original.semester || '').toLowerCase()
      return title.includes(search) || code.includes(search) || program.includes(search) || semester.includes(search)
    },
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search labs...'
        filters={isDeletedTab ? [] : [
          {
            columnId: 'status',
            title: 'Status',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Maintenance', value: 'maintenance' },
            ],
          },
          {
            columnId: 'program',
            title: 'Program',
            options: programs.map(p => ({ label: p as string, value: p as string })),
          },
          {
            columnId: 'semester',
            title: 'Semester',
            options: semesters.map(s => ({ label: s as string, value: s as string })),
          },
          {
            columnId: 'runtimeType',
            title: 'Runtime',
            options: runtimeTypes.map(rt => ({ label: rt as string, value: rt as string })),
          },
          {
            columnId: 'credits',
            title: 'Credits',
            options: credits.map(c => ({ label: String(c), value: c as any })),
          },
          {
            columnId: 'durationMinutes',
            title: 'Duration',
            options: durations.map(d => ({ label: `${d} Minutes`, value: d as any })),
          },
        ]}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
