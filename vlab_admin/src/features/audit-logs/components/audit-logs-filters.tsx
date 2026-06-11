import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Download, CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { sleep, cn } from '@/lib/utils'
import { useState } from 'react'
import { format } from 'date-fns'

export function AuditLogsFilters() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  const handleExport = async () => {
    toast.promise(sleep(1500), {
      loading: `Generating cryptographic log export...`,
      success: `Secure CSV export generated successfully!`,
      error: 'Failed to generate export',
    })
  }

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[200px] justify-start text-left font-normal bg-card/50",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date range</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleExport} className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono">
          <Download className="mr-2 h-4 w-4" />
          EXPORT .CSV
        </Button>
      </div>
    </div>
  )
}
