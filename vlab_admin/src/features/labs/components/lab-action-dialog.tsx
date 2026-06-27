'use client'

import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Lab, labSchema } from '../data/schema'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { useCreateLabMutation, useUpdateLabMutation, useRuntimeTypesQuery } from '../data/api'

const formSchema = labSchema.omit({
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
}).extend({
  isEdit: z.boolean(),
})

type LabForm = z.infer<typeof formSchema>

type LabActionDialogProps = {
  currentRow?: Lab
  mode: 'create' | 'edit' | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LabActionDialog({
  currentRow,
  mode,
  open,
  onOpenChange,
}: LabActionDialogProps) {
  const isEdit = mode === 'edit'

  const createMutation = useCreateLabMutation()
  const updateMutation = useUpdateLabMutation()
  const { data: runtimeTypes = [], isLoading: isLoadingRuntimes } = useRuntimeTypesQuery()

  const form = useForm<LabForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: '',
      title: '',
      subtitle: '',
      program: '',
      semester: '',
      logoUrl: '',
      category: 'Development',
      credits: 100,
      durationMinutes: 60,
      complexity: 'Intermediate',
      runtimeType: 'ide',
      runtimePort: 8080,
      runtimePath: '/workspace',
      containerApiPath: '',
      taskDefinition: '',
      instructions: '',
      status: 'active',
      isEdit: false,
    },
  })

  useEffect(() => {
    if (open) {
      if (isEdit && currentRow) {
        form.reset({
          id: currentRow.id,
          title: currentRow.title,
          subtitle: currentRow.subtitle || '',
          program: currentRow.program || '',
          semester: currentRow.semester || '',
          logoUrl: currentRow.logoUrl || '',
          category: currentRow.category || 'Development',
          credits: currentRow.credits || 0,
          durationMinutes: currentRow.durationMinutes || 60,
          complexity: currentRow.complexity || 'Intermediate',
          runtimeType: currentRow.runtimeType || 'ide',
          runtimePort: currentRow.runtimePort || 8080,
          runtimePath: currentRow.runtimePath || '/workspace',
          containerApiPath: currentRow.containerApiPath || '',
          taskDefinition: currentRow.taskDefinition || '',
          instructions: currentRow.instructions || '',
          status: currentRow.status,
          isEdit,
        })
      } else {
        form.reset({
          id: '',
          title: '',
          subtitle: '',
          program: '',
          semester: '',
          logoUrl: '',
          category: 'Development',
          credits: 100,
          durationMinutes: 60,
          complexity: 'Intermediate',
          runtimeType: 'ide',
          runtimePort: 8080,
          runtimePath: '/workspace',
          containerApiPath: '',
          taskDefinition: '',
          instructions: '',
          status: 'maintenance',
          isEdit: false,
        })
      }
    }
  }, [open, currentRow, isEdit, form])

  const onSubmit = async (values: LabForm) => {
    try {
      if (isEdit && currentRow) {
        await updateMutation.mutateAsync({ labId: currentRow.id, payload: values })
        toast.success('Lab updated successfully!')
      } else {
        await createMutation.mutateAsync(values)
        toast.success('Lab created successfully!')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to save lab.')
    }
  }

  let dialogTitle = 'Create New Lab'
  let desc = 'Configure a new lab environment.'
  if (isEdit) {
    dialogTitle = 'Edit Lab Configuration'
    desc = 'Modify the settings for this lab.'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className='flex-1 overflow-y-auto px-1 py-4'>
          <Form {...form}>
            <form id='lab-form' onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">General Information</h3>
                
                <div className='grid grid-cols-2 gap-4'>
                  <FormField control={form.control} name='id' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lab Code</FormLabel>
                      <FormControl><Input placeholder='e.g. LAB-001' {...field} disabled={isEdit} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name='title' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input placeholder='Lab Title' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <FormField control={form.control} name='subtitle' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle</FormLabel>
                      <FormControl><Input placeholder='Brief subtitle' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name='program' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program</FormLabel>
                      <FormControl><Input placeholder='e.g. B.Tech' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <FormField control={form.control} name='semester' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semester</FormLabel>
                      <FormControl><Input placeholder='e.g. Semester 1' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name='logoUrl' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl><Input placeholder='https://...' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <FormField control={form.control} name='complexity' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complexity</FormLabel>
                      <FormControl><Input placeholder='e.g. Beginner, Intermediate' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium border-b pb-2">Environment & Billing</h3>
                
                <div className='grid grid-cols-2 gap-4'>
                  <FormField control={form.control} name='credits' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Cost</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name='durationMinutes' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (Minutes)</FormLabel>
                      <FormControl><Input type="number" min={15} step={15} {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <FormField control={form.control} name='runtimeType' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Runtime Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoadingRuntimes}>
                        <FormControl><SelectTrigger><SelectValue placeholder={isLoadingRuntimes ? "Loading..." : "Select Runtime"} /></SelectTrigger></FormControl>
                        <SelectContent>
                          {runtimeTypes.map((rt) => (
                            <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name='runtimePort' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <FormField control={form.control} name='runtimePath' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Runtime Path</FormLabel>
                      <FormControl><Input placeholder='e.g. /workspace' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name='containerApiPath' render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container API Path</FormLabel>
                      <FormControl><Input placeholder='/api/...' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem> 
                  )} />
                </div>

                <FormField control={form.control} name='taskDefinition' render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Definition (Docker Image)</FormLabel>
                    <FormControl><Input placeholder='e.g. ubuntu:latest' {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium border-b pb-2">Instructions</h3>
                <FormField control={form.control} name='instructions' render={({ field }) => (
                  <FormItem>
                    <FormLabel>Markdown Instructions</FormLabel>
                    <FormControl>
                      <Textarea placeholder='# Welcome to the Lab...' className="font-mono text-xs h-32" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {isEdit && currentRow && (
                <div className="space-y-4 pt-2">
                  <h3 className="text-lg font-medium border-b pb-2">Audit Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created Date</p>
                      <p className="font-semibold mt-1">
                        {currentRow.createdAt ? new Date(currentRow.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                      <p className="font-semibold mt-1">
                        {currentRow.updatedAt ? new Date(currentRow.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </form>
          </Form>
        </div>
        <DialogFooter className='pt-2'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type='submit' form='lab-form' disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Lab Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
