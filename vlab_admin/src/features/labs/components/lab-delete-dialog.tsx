'use client'

import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type Lab } from '../data/schema'

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
  if (!currentRow) return null

  const handleDelete = () => {
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Deleting lab...',
      success: () => {
        return `Lab "${currentRow.name}" successfully deleted.`
      },
      error: 'Failed to delete lab.',
    })
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
            Are you sure you want to delete <strong>{currentRow.name}</strong>?
            This will immediately disconnect any active sessions.
          </p>

          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              This operation cannot be rolled back.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText='Delete Lab'
      destructive
    />
  )
}
