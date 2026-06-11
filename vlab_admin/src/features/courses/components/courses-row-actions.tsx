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
import { type Course } from '../data/schema'
import { useCourses } from '../context/courses-context'
import { Link } from '@tanstack/react-router'
import { Eye, Edit, Trash, FlaskConical } from 'lucide-react'

interface CoursesRowActionsProps {
  row: Row<Course>
}

export function CoursesRowActions({ row }: CoursesRowActionsProps) {
  const { setDialogOpen, setCurrentRow } = useCourses()

  const handleAction = (action: 'edit' | 'delete' | 'assign-labs') => {
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
          <Link to={`/courses/${row.original.id}`} className="flex items-center cursor-pointer">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('edit')}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Course
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction('assign-labs')}>
          <FlaskConical className="mr-2 h-4 w-4 text-emerald-500" />
          Assign Labs
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
