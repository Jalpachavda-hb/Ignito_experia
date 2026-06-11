import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Row } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Program } from '../data/schema'
import { usePrograms } from '../context/programs-context'
import { Link } from '@tanstack/react-router'
import { Eye, Edit, Trash, Network } from 'lucide-react'

interface ProgramsRowActionsProps {
  row: Row<Program>
}

export function ProgramsRowActions({ row }: ProgramsRowActionsProps) {
  const { setDialogOpen, setCurrentRow } = usePrograms()

  const handleAction = (action: 'edit' | 'delete') => {
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
      <DropdownMenuContent align='end' className='w-[170px]'>
        <DropdownMenuItem asChild>
          <Link to={`/programs/${row.original.id}`} className="flex items-center cursor-pointer">
            <Network className="mr-2 h-4 w-4 text-emerald-500" />
            View Hierarchy
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('edit')}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Program
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleAction('delete')}
          className='text-red-600 focus:text-red-600'
        >
          <Trash className="mr-2 h-4 w-4" />
          Delete
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
