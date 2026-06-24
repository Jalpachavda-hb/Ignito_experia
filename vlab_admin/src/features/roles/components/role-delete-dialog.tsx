'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { type Role } from '../data/schema'
import { deleteRole } from '@/services/rolesService'

type RoleDeleteDialogProps = {
  currentRow?: Role
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function RoleDeleteDialog({
  currentRow,
  open,
  onOpenChange,
  onSuccess,
}: RoleDeleteDialogProps) {
  if (!currentRow) return null

  const mutation = useMutation({
    mutationFn: () => deleteRole(currentRow.roleId),
    onSuccess: () => {
      onOpenChange(false)
      toast.success(`Role "${currentRow.name}" deleted successfully.`)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete role.')
    },
  })

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
            mutation.mutate()
          }}
          className='space-y-4 pt-4'
        >
          <div className='flex items-center gap-2'>
            <p className='mb-2'>
              Are you sure you want to delete the role{' '}
              <strong>{currentRow.name}</strong>?
            </p>
            {currentRow.isSystem && (
              <Badge variant='secondary'>System Role</Badge>
            )}
          </div>

          {currentRow.userCount > 0 && (
            <p className='text-sm text-muted-foreground'>
              There are{' '}
              <span className='font-semibold text-foreground'>
                {currentRow.userCount}
              </span>{' '}
              users currently assigned to this role.
            </p>
          )}

          {currentRow.isSystem ? (
            <Alert variant='destructive'>
              <AlertTitle>Cannot Delete System Role</AlertTitle>
              <AlertDescription>
                System roles are built-in and cannot be deleted. You can edit their permissions instead.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant='destructive'>
              <AlertTitle>Warning!</AlertTitle>
              <AlertDescription>
                Deleting this role will revoke these permissions from all{' '}
                {currentRow.userCount} assigned users. This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}
        </form>
      }
      confirmText={
        mutation.isPending ? (
          <span className='flex items-center gap-2'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Deleting...
          </span>
        ) : (
          'Delete Role'
        )
      }
      isLoading={mutation.isPending}
      disabled={currentRow.isSystem || mutation.isPending}
      destructive
    />
  )
}
