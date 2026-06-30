import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react'
import { type Row } from '@tanstack/react-table'
import { useState } from 'react'
import { type Lab } from '../data/schema'
import { useLabs } from '../context/labs-context'

interface LabsRowActionsProps {
  row: Row<Lab>
}

export function LabsRowActions({ row }: LabsRowActionsProps) {
  const [open, setOpen] = useState(false)
  const { setDialogOpen, setCurrentRow } = useLabs()

  const handleAction = (action: 'view' | 'edit' | 'delete') => {
    setCurrentRow(row.original)
    setDialogOpen(action)
    setOpen(false)
  }

  return (
    <div className="relative flex justify-end">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-44 glass rounded-xl border border-border py-1 shadow-xl">
            <button
              onClick={() => handleAction('view')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              View Details
            </button>
            <button
              onClick={() => handleAction('edit')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              Edit Lab
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => handleAction('delete')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
