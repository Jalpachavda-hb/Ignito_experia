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
import { type Semester } from '../data/schema'
import { useSemesters } from '../context/semesters-context'
import { Link } from '@tanstack/react-router'
import { Eye, Edit, Trash } from 'lucide-react'

interface SemestersRowActionsProps {
  row: Row<Semester>
}

export function SemestersRowActions({ row }: SemestersRowActionsProps) {
  const { setDialogOpen, setCurrentRow } = useSemesters()

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
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem asChild>
          <Link to={`/semesters/${row.original.id}`} className="flex items-center cursor-pointer">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('edit')}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Semester
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
