'use client'

import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type Role } from '../data/schema'

type RoleDeleteDialogProps = {
  currentRow?: Role
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoleDeleteDialog({
  currentRow,
  open,
  onOpenChange,
}: RoleDeleteDialogProps) {
  if (!currentRow) return null

  const handleDelete = () => {
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Deleting role...',
      success: () => {
        return `Role "${currentRow.name}" successfully deleted.`
      },
      error: 'Failed to delete role.',
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='role-delete-form'
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Delete Role
        </span>
      }
      desc={
        <form
          id='role-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4 pt-4'
        >
          <p className='mb-2'>
            Are you sure you want to delete the role <strong>{currentRow.name}</strong>?
            There are {currentRow.userCount} users currently assigned to this role.
          </p>

          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              Deleting this role will revoke these permissions from all {currentRow.userCount} assigned users. They will fall back to default permissions.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText='Delete Role'
      destructive
    />
  )
}
