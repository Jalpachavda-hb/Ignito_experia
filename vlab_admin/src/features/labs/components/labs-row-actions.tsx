import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Row } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem, 
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Lab } from '../data/schema'
import { useLabs } from '../context/labs-context'

interface LabsRowActionsProps {
  row: Row<Lab>
}

export function LabsRowActions({ row }: LabsRowActionsProps) {
  const { setDialogOpen, setCurrentRow } = useLabs()

  const handleAction = (action: 'view' | 'edit' | 'delete') => {
    setCurrentRow(row.original)
    setDialogOpen(action)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem onClick={() => handleAction('view')}>
          View Details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
