import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Row } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type AuditLog } from '../data/schema'
import { useAuditLogs } from '../context/audit-logs-context'
import { FileJson } from 'lucide-react'

interface AuditLogsRowActionsProps {
  row: Row<AuditLog>
}

export function AuditLogsRowActions({ row }: AuditLogsRowActionsProps) {
  const { setSheetOpen, setCurrentRow } = useAuditLogs()

  const handleViewDetails = () => {
    setCurrentRow(row.original)
    setSheetOpen(true)
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
        <DropdownMenuItem onClick={handleViewDetails} className="cursor-pointer">
          <FileJson className="mr-2 h-4 w-4" />
          View Raw Payload
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
