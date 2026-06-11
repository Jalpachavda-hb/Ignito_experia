import { type Lab } from '../data/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLabs } from '../context/labs-context'
import { Button } from '@/components/ui/button'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Clock, Database } from 'lucide-react'

interface LabsKanbanProps {
  data: Lab[]
}

export function LabsKanban({ data }: LabsKanbanProps) {
  const { setDialogOpen, setCurrentRow } = useLabs()

  const handleAction = (lab: Lab, action: 'view' | 'edit' | 'clone' | 'delete') => {
    setCurrentRow(lab)
    setDialogOpen(action)
  }

  // Group by category to achieve exactly 5 columns
  const columns = [
    { id: 'Security', title: 'Security', color: 'bg-red-500/10 border-red-500/20' },
    { id: 'Networking', title: 'Networking', color: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'Development', title: 'Development', color: 'bg-emerald-500/10 border-emerald-500/20' },
    { id: 'Data Science', title: 'Data Science', color: 'bg-purple-500/10 border-purple-500/20' },
    { id: 'Cloud Computing', title: 'Cloud Computing', color: 'bg-amber-500/10 border-amber-500/20' },
  ]

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {columns.map((col) => {
        const columnLabs = data.filter((lab) => lab.category === col.id)

        return (
          <div key={col.id} className="flex-shrink-0 w-[280px] flex flex-col gap-4">
            <div className={`rounded-md border p-3 flex items-center justify-between font-semibold ${col.color}`}>
              <span className="capitalize">{col.title}</span>
              <Badge variant="secondary" className="bg-background/50">{columnLabs.length}</Badge>
            </div>
            
            <div className="flex flex-col gap-4 flex-1">
              {columnLabs.slice(0, 5).map((lab) => (
                <Card key={lab.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow relative group">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant={lab.status === 'active' ? 'default' : lab.status === 'maintenance' ? 'secondary' : 'destructive'} className="mb-2 text-[10px] capitalize">
                        {lab.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-6 w-6 p-0 -mt-1 -mr-1">
                            <DotsHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAction(lab, 'view')}>View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(lab, 'edit')}>Edit Lab</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(lab, 'clone')}>Clone Lab</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAction(lab, 'delete')} className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-base line-clamp-1">{lab.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex flex-wrap gap-1 mb-4">
                      {lab.technologies.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          {tag}
                        </Badge>
                      ))}
                      {lab.technologies.length > 3 && (
                        <span className='text-xs text-muted-foreground'>+{lab.technologies.length - 3}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Database className="h-3.5 w-3.5" />
                        <span>{lab.creditCost} cr</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{lab.durationMinutes / 60}h</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
