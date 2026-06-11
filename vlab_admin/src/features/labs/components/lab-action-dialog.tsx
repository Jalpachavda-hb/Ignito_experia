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
  
const formSchema = labSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  technologies: true // Override to string for easy input
}).extend({
  technologiesStr: z.string().min(1, 'At least one technology tag is required (comma separated).'),
  isEdit: z.boolean(),
  isClone: z.boolean().optional(),
})

type LabForm = z.infer<typeof formSchema>

type LabActionDialogProps = {
  currentRow?: Lab
  mode: 'create' | 'edit' | 'clone' | null
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
  const isClone = mode === 'clone'

  const form = useForm<LabForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'Development',
      status: 'active',
      creditCost: 100,
      durationMinutes: 60,
      dockerImage: '',
      technologiesStr: '',
      environmentConfig: '',
      instructions: '',
      isEdit: false,
    },
  })

  useEffect(() => {
    if (open) {
      if ((isEdit || isClone) && currentRow) {
        form.reset({
          name: isClone ? `${currentRow.name} (Clone)` : currentRow.name,
          description: currentRow.description || '',
          category: currentRow.category,
          status: isClone ? 'maintenance' : currentRow.status, // Clones start in maintenance
          creditCost: currentRow.creditCost,
          durationMinutes: currentRow.durationMinutes,
          dockerImage: currentRow.dockerImage,
          technologiesStr: currentRow.technologies.join(', '),
          environmentConfig: currentRow.environmentConfig || '',
          instructions: currentRow.instructions || '',
          isEdit,
          isClone,
        })
      } else {
        form.reset({
          name: '',
          description: '',
          category: 'Development',
          status: 'maintenance',
          creditCost: 100,
          durationMinutes: 60,
          dockerImage: '',
          technologiesStr: '',
          environmentConfig: '{\n  "ENV_VAR": "value"\n}',
          instructions: '',
          isEdit: false,
        })
      }
    }
  }, [open, currentRow, isEdit, isClone, form])

  const onSubmit = (values: LabForm) => {
    toast.success(`Lab ${isEdit ? 'updated' : isClone ? 'cloned' : 'created'} successfully!`)
    onOpenChange(false)
  }

  let title = 'Create New Lab'
  let desc = 'Configure a new lab environment and docker image.'
  if (isEdit) {
    title = 'Edit Lab Configuration'
    desc = 'Modify the settings and environment variables for this lab.'
  } else if (isClone) {
    title = 'Clone Lab'
    desc = 'Create a copy of this lab. Clones default to Maintenance status.'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className='flex-1 overflow-y-auto px-1 py-4'>
          <Form {...form}>
            <form id='lab-form' onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">General Information</h3>
                <div className='grid grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lab Name</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g. Ubuntu Server Basics' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='category'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Security">Security</SelectItem>
                            <SelectItem value="Networking">Networking</SelectItem>
                            <SelectItem value="Development">Development</SelectItem>
                            <SelectItem value="Data Science">Data Science</SelectItem>
                            <SelectItem value="Cloud Computing">Cloud Computing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name='description'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder='Briefly describe the lab...' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='grid grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='technologiesStr'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technology Tags (comma separated)</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g. Linux, Docker, Python' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='status'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="deprecated">Deprecated</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium border-b pb-2">Environment & Billing</h3>
                
                <FormField
                  control={form.control}
                  name='dockerImage'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Docker Image Path</FormLabel>
                      <FormControl>
                        <Input placeholder='e.g. registry.vlab.edu/ubuntu-base:latest' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='grid grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='creditCost'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Cost (per launch)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='durationMinutes'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (Minutes)</FormLabel>
                        <FormControl>
                          <Input type="number" min={15} step={15} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='environmentConfig'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Environment Configuration (JSON)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder='{\n  "ENV_VAR": "value"\n}' 
                          className="font-mono text-xs h-24" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium border-b pb-2">Instructions</h3>
                <FormField
                  control={form.control}
                  name='instructions'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Markdown Instructions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder='# Welcome to the Lab...' 
                          className="font-mono text-xs h-32" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            </form>
          </Form>
        </div>
        <DialogFooter className='pt-2'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type='submit' form='lab-form'>Save Lab Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
