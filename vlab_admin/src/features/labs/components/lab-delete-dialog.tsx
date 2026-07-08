'use client'

import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type Lab } from '../data/schema'
import { useDeleteLabMutation } from '../data/api'

type LabDeleteDialogProps = {
  currentRow?: Lab
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LabDeleteDialog({
  currentRow,
  open,
  onOpenChange,
}: LabDeleteDialogProps) {
  const deleteMutation = useDeleteLabMutation()

  if (!currentRow) return null

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(currentRow.id)
      toast.success(`Lab "${currentRow.title}" successfully deleted.`)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to delete lab.')
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='lab-delete-form'
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Delete Lab
        </span>
      }
      desc={
        <form
          id='lab-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4 pt-4'
        >
          <p className='mb-2'>
            Are you sure you want to delete <strong>{currentRow.title}</strong>?
            This will immediately disconnect any active sessions.
          </p>

          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              This action will permanently delete the lab from the system. This cannot be undone.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete Lab'}
      destructive
    />
  )
}
