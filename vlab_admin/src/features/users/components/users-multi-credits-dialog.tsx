'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Database } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'

type UserMultiCreditsDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

export function UsersMultiCreditsDialog<TData>({
  open,
  onOpenChange,
  table,
}: UserMultiCreditsDialogProps<TData>) {
  const [value, setValue] = useState('500')

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleAssign = () => {
    const amount = Number(value)
    if (isNaN(amount) || amount <= 0) {
      toast.error(`Please enter a valid amount greater than 0.`)
      return
    }

    onOpenChange(false)

    toast.promise(sleep(2000), {
      loading: 'Assigning credits...',
      success: () => {
        setValue('500')
        table.resetRowSelection()
        return `Assigned ${amount} credits to ${selectedRows.length} ${
          selectedRows.length > 1 ? 'users' : 'user'
        }`
      },
      error: 'Error',
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-multi-credits-form'
      disabled={isNaN(Number(value)) || Number(value) <= 0}
      title={
        <span className='text-primary flex items-center'>
          <Database
            className='me-2 inline-block stroke-primary'
            size={18}
          />{' '}
          Assign Credits to {selectedRows.length}{' '}
          {selectedRows.length > 1 ? 'users' : 'user'}
        </span>
      }
      desc={
        <form
          id='users-multi-credits-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleAssign()
          }}
          className='space-y-4 pt-2'
        >
          <p className='mb-2'>
            Enter the number of credits to allocate to all selected users. This will add to their existing balance.
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span className=''>Credits to assign:</span>
            <Input
              type='number'
              min={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`e.g. 500`}
              autoFocus
            />
          </Label>
        </form>
      }
      confirmText='Assign Credits'
    />
  )
}
