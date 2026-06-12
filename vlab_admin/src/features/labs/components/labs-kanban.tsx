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
import { Clock, Database, Server, Calendar } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useUpdateLabStatusMutation } from '../data/api'

interface LabsKanbanProps {
  data: Lab[]
}

export function LabsKanban({ data }: LabsKanbanProps) {
  const { setDialogOpen, setCurrentRow } = useLabs()
  const updateStatusMutation = useUpdateLabStatusMutation()

  const handleAction = (lab: Lab, action: 'view' | 'edit' | 'delete') => {
    setCurrentRow(lab)
    setDialogOpen(action)
  }

  const handleStatusToggle = (lab: Lab, checked: boolean) => {
    updateStatusMutation.mutate({
      labId: lab.id,
      status: checked ? 'active' : 'inactive'
    })
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
                  <DropdownMenuItem onClick={() => handleAction(lab, 'edit')}>Edit Lab</DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAction(lab, 'delete')} className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardTitle className="text-base leading-tight">{lab.title}</CardTitle>
            {lab.subtitle && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{lab.subtitle}</p>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-end">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Switch 
                  checked={lab.status === 'active'}
                  onCheckedChange={(checked) => handleStatusToggle(lab, checked)}
                  className="scale-75 origin-left"
                />
                <span className="text-xs text-muted-foreground font-medium">
                  {lab.status === 'active' ? '[ ON ] Active' : '[ OFF ] Inactive'}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                {lab.complexity || 'Intermediate'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span className="truncate">{lab.semester || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <Server className="h-3.5 w-3.5" />
                <span className="truncate">{lab.runtimeType || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-emerald-500" />
                <span>{lab.credits} credits</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>{lab.durationMinutes} Minutes</span>
                  </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
