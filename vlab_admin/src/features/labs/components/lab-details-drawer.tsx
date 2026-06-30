
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type Lab } from '../data/schema'
import { ScrollArea } from '@/components/ui/scroll-area'
import {

  Database,
  
  Clock,
  MonitorPlay,


  Edit,
  Trash,
  Code
} from 'lucide-react'

type LabDetailsDrawerProps = {
  lab?: Lab
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void

  onDelete: () => void
}

export function LabDetailsDrawer({ lab, open, onOpenChange, onEdit, onDelete }: LabDetailsDrawerProps) {
  if (!lab) return null

  const getStatusVariant = (status: string) => {
    if (status === 'inactive' || status === 'maintenance') return 'secondary'
    if (status === 'deprecated' || status === 'deleted') return 'destructive'
    return 'default'
  }

  const mins = lab.durationMinutes || 0
  const displayDuration = `${mins} Minutes`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="p-6 pb-0 border-b border-border/50 bg-muted/20 relative">

          <div className="flex items-start gap-4 mb-6 pt-2">
            <div className="h-16 w-16 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0">
              {lab.logoUrl ? (
                <img src={lab.logoUrl} alt={lab.title} className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <MonitorPlay className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="flex-1 space-y-1.5 pr-8">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-2xl font-bold leading-none">{lab.title}</SheetTitle>
              </div>
              <SheetDescription className="text-base font-medium text-muted-foreground mt-1 line-clamp-2">
                {lab.subtitle || 'No subtitle provided.'}
              </SheetDescription>
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Badge variant={getStatusVariant(lab.status)} className="capitalize">
                  Status: {lab.status}
                </Badge>
                <Badge variant="outline" className="bg-primary/5 capitalize">
                  {lab.category || 'Development'}
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/5 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-300">
                  <Database className="h-3 w-3 mr-1" />
                  {Intl.NumberFormat('en-US').format(lab.credits || 0)} Credits
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-12 bg-muted/50">
              <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
              <TabsTrigger value="environment" className="text-xs sm:text-sm">Environment</TabsTrigger>
              <TabsTrigger value="instructions" className="text-xs sm:text-sm">Instructions</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6 space-y-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">General Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Lab Code</p>
                      <p className="font-semibold mt-1 font-mono">{lab.id}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Program</p>
                      <p className="font-semibold mt-1">{lab.program || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Semester</p>
                      <p className="font-semibold mt-1">{lab.semester || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Complexity</p>
                      <p className="font-semibold mt-1">{lab.complexity || 'Intermediate'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Duration</p>
                      <p className="font-semibold mt-1 flex items-center">
                        <Clock className="h-4 w-4 mr-1.5 text-blue-500" />
                        {displayDuration}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Credits</p>
                      <p className="font-semibold mt-1 text-emerald-600 flex items-center">
                        <Database className="h-4 w-4 mr-1.5" />
                        {Intl.NumberFormat('en-US').format(lab.credits || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created Date</p>
                      <p className="font-semibold mt-1">
                        {lab.createdAt ? new Date(lab.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                      <p className="font-semibold mt-1">
                        {lab.updatedAt ? new Date(lab.updatedAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm bg-muted/10">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="w-full flex-col h-auto py-3 gap-2" onClick={() => { onOpenChange(false); onEdit(); }}>
                      <Edit className="h-4 w-4" />
                      <span className="text-xs">Edit Lab</span>
                    </Button>
                    <Button variant="outline" className="w-full flex-col h-auto py-3 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => { onOpenChange(false); onDelete(); }}>
                      <Trash className="h-4 w-4" />
                      <span className="text-xs">Delete Lab</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="environment" className="mt-6 space-y-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Environment Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Task Definition (Docker Image)</p>
                      <p className="font-mono text-sm mt-1.5 p-2 bg-muted/50 rounded-md border border-border/50">
                        {lab.taskDefinition || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Runtime Type</p>
                      <p className="font-semibold mt-1">{lab.runtimeType || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Runtime Port</p>
                      <p className="font-semibold mt-1 font-mono">{lab.runtimePort || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Runtime Path</p>
                      <p className="font-mono text-sm mt-1.5 p-2 bg-muted/50 rounded-md border border-border/50">
                        {lab.runtimePath || 'N/A'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Container API Path</p>
                      <p className="font-mono text-sm mt-1.5 p-2 bg-muted/50 rounded-md border border-border/50">
                        {lab.containerApiPath || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="instructions" className="mt-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Lab Instructions</CardTitle>
                  <CardDescription>Markdown formatted instructions shown to the user.</CardDescription>
                </CardHeader>
                <CardContent>
                  {lab.instructions ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none p-6 rounded-lg border border-border/50 bg-muted/10">
                      <pre className="font-sans whitespace-pre-wrap text-sm m-0 bg-transparent p-0 border-0">
                        {lab.instructions}
                      </pre>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center bg-muted/10">
                      <Code className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                      <p className="text-sm font-medium">No instructions provided</p>
                      <p className="text-xs text-muted-foreground mt-1">This lab does not have specific markdown instructions attached.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
