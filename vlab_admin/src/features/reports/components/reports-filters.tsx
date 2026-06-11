import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Download, FileDown, CalendarIcon, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { sleep, cn } from '@/lib/utils'
import { useState } from 'react'
import { format } from 'date-fns'

export function ReportsFilters() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  const handleExport = async (type: string) => {
    toast.promise(sleep(1500), {
      loading: `Generating ${type} report...`,
      success: `${type} export downloaded successfully!`,
      error: 'Failed to generate report',
    })
  }

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 border rounded-lg bg-card text-card-foreground shadow-sm mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[200px] justify-start text-left font-normal",
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

        <Select defaultValue="all-courses">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Course Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-courses">All Courses</SelectItem>
            <SelectItem value="btech">B.Tech</SelectItem>
            <SelectItem value="mca">MCA</SelectItem>
            <SelectItem value="bca">BCA</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all-semesters">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Semester Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-semesters">All Semesters</SelectItem>
            <SelectItem value="fall2026">Fall 2026</SelectItem>
            <SelectItem value="spring2026">Spring 2026</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport('CSV')}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('Excel')}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel
        </Button>
        <Button size="sm" onClick={() => handleExport('PDF')} className="bg-red-600 hover:bg-red-700 text-white">
          <FileDown className="mr-2 h-4 w-4" />
          PDF
        </Button>
      </div>
    </div>
  )
}
