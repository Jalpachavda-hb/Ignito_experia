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
import { Clock, Database, Server } from 'lucide-react'

interface LabsKanbanProps {
  data: Lab[]
}

export function LabsKanban({ data }: LabsKanbanProps) {
  const { setDialogOpen, setCurrentRow } = useLabs()

  const handleAction = (lab: Lab, action: 'view' | 'edit' | 'delete') => {
    setCurrentRow(lab)
    setDialogOpen(action)
  }

  const handleStatusToggle = (_lab: Lab, _checked: boolean) => {
    // Optional status toggle logic
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
      {data.map((lab) => (
        <Card key={lab.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                {lab.logoUrl ? (
                  <img src={lab.logoUrl} alt={lab.title} className="w-6 h-6 rounded-sm object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-sm bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {lab.title.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <Badge variant={lab.status === 'active' ? 'default' : lab.status === 'inactive' ? 'secondary' : 'destructive'} className="text-[10px] capitalize">
                  {lab.status}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 w-6 p-0 -mt-1 -mr-1">
                    <DotsHorizontalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAction(lab, 'view')}>View Details</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardTitle className="text-base leading-tight">{lab.title}</CardTitle>
            {lab.subtitle && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{lab.subtitle}</p>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-end">
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-3">
              <div className="flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" />
                <span className="truncate">{lab.runtimeType || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>{lab.durationMinutes} Minutes</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <Database className="h-3.5 w-3.5 text-emerald-500" />
                <span>{lab.credits} credits</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
