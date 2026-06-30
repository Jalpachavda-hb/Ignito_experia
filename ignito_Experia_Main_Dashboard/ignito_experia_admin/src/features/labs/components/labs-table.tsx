import { useState, useMemo } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react'
import { type Lab } from '../data/schema'
import { LabsRowActions } from './labs-row-actions'
import { useUpdateLabStatusMutation } from '../data/api'
import { cn } from '@/lib/utils'

const StatusToggle = ({ lab }: { lab: Lab }) => {
  const mutation = useUpdateLabStatusMutation()
  return (
    <button
      onClick={(e) => { e.stopPropagation(); mutation.mutate({ labId: lab.id, status: lab.status === 'active' ? 'inactive' : 'active' }) }}
      disabled={mutation.isPending}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all',
        lab.status === 'active'
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
          : 'bg-secondary text-muted-foreground border border-border hover:bg-accent'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', lab.status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground')} />
      {lab.status === 'active' ? 'Active' : 'Inactive'}
    </button>
  )
}

interface LabsTableProps {
  data: Lab[]
}

export function LabsTable({ data }: LabsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<Lab>[]>(() => [
    {
      accessorKey: 'title',
      header: 'Lab Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.logoUrl ? (
            <img src={row.original.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {row.original.title.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground text-sm">{row.original.title}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.original.id}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'runtimeType',
      header: 'Runtime',
      cell: ({ row }) => (
        <span className="px-2 py-0.5 rounded-md bg-secondary border border-border text-xs font-mono text-foreground font-medium">
          {row.original.runtimeType?.toUpperCase() || 'IDE'}
        </span>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.category || '—'}</span>
      ),
    },
    {
      accessorKey: 'credits',
      header: 'Credits',
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-sm text-foreground">{row.original.credits}</span>
      ),
    },
    {
      accessorKey: 'durationMinutes',
      header: 'Duration',
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.durationMinutes} min</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusToggle lab={row.original} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => <LabsRowActions row={row} />,
    },
  ], [])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search labs..."
          className="w-full max-w-sm pl-9 pr-4 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-border bg-secondary/50">
                {hg.headers.map(header => (
                  <th key={header.id} className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">No labs found.</td></tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/15 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {table.getFilteredRowModel().rows.length} lab{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''} total
        </span>
        <div className="flex items-center gap-1">
          <PaginationBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><ChevronsLeft className="h-4 w-4" /></PaginationBtn>
          <PaginationBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></PaginationBtn>
          <span className="px-3 py-1.5 text-foreground font-semibold">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <PaginationBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></PaginationBtn>
          <PaginationBtn onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}><ChevronsRight className="h-4 w-4" /></PaginationBtn>
        </div>
      </div>
    </div>
  )
}

function PaginationBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}
