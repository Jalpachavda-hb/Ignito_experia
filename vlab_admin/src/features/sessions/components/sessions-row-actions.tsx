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
import { type Session } from '../data/schema'
import { useSessions } from '../context/sessions-context'
import { Terminal, Clock, PowerOff } from 'lucide-react'

interface SessionsRowActionsProps {
  row: Row<Session>
}

export function SessionsRowActions({ row }: SessionsRowActionsProps) {
  const { setDialogOpen, setCurrentRow } = useSessions()
  const isRunning = row.original.status === 'running'

  const handleAction = (action: 'logs' | 'extend' | 'terminate') => {
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
        <DropdownMenuItem onClick={() => handleAction('logs')}>
          <Terminal className="mr-2 h-4 w-4" />
          View Logs
        </DropdownMenuItem>
        
        {isRunning && (
          <>
            <DropdownMenuItem onClick={() => handleAction('extend')}>
              <Clock className="mr-2 h-4 w-4 text-emerald-500" />
              Extend Time
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleAction('terminate')}
              className='text-red-600 focus:text-red-600'
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Terminate
              <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
