import { AlertTriangle, Loader2 } from 'lucide-react'
import { type Lab } from '../data/schema'
import { useDeleteLabMutation } from '../data/api'

interface LabDeleteDialogProps {
  currentRow?: Lab
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LabDeleteDialog({ currentRow, open, onOpenChange }: LabDeleteDialogProps) {
  const deleteMutation = useDeleteLabMutation()

  if (!currentRow || !open) return null

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(currentRow.id)
      onOpenChange(false)
    } catch {
      // toast handled in mutation
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative glass rounded-2xl w-full max-w-md border border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Delete Lab</h2>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>

        <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-foreground">
          Are you sure you want to delete <strong className="text-destructive">{currentRow.title}</strong>?
          <br />
          <span className="text-xs text-muted-foreground mt-1 block">
            Lab Code: {currentRow.id} · This will soft-delete the lab from the catalog.
          </span>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Lab'}
          </button>
        </div>
      </div>
    </div>
  )
}
