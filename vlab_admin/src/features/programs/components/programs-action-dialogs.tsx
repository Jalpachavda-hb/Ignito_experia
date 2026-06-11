import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { type Program } from '../data/schema'
import { useForm } from 'react-hook-form'

interface ProgramActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'create' | 'edit' | 'delete' | null
  program?: Program
}

export function ProgramActionDialogs({ open, onOpenChange, type, program }: ProgramActionDialogProps) {
  const isEdit = type === 'edit'
  
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: program?.name || '',
      code: program?.code || '',
      degree: program?.degree || 'Bachelors',
      durationYears: program?.durationYears || 4,
    }
  })

  if (!type) return null

  const onSubmit = async (data: any) => {
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Saving...',
      success: () => `${isEdit ? 'Updated' : 'Created'} program successfully.`,
      error: 'Failed to save',
    })
  }

  const onDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Deleting program...',
      success: 'Program deleted successfully.',
      error: 'Failed to delete program',
    })
  }

  if (type === 'create' || type === 'edit') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Program' : 'Create New Program'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Modify the program configuration.' : 'Define a new academic program like MCA or B.Tech.'}
            </DialogDescription>
          </DialogHeader>
          <form id="program-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Program Name</Label>
                <Input {...register('name')} placeholder="e.g. Bachelor of Technology" required />
              </div>
              <div className="space-y-2">
                <Label>Program Code</Label>
                <Input {...register('code')} placeholder="e.g. B.Tech" required />
              </div>
              <div className="space-y-2">
                <Label>Degree Type</Label>
                <Select defaultValue={program?.degree || 'Bachelors'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Degree" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bachelors">Bachelors</SelectItem>
                    <SelectItem value="Masters">Masters</SelectItem>
                    <SelectItem value="Doctorate">Doctorate</SelectItem>
                    <SelectItem value="Diploma">Diploma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Duration (Years)</Label>
                <Input type="number" min={1} max={5} {...register('durationYears')} required />
              </div>
            </div>
          </form>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="program-form">{isEdit ? 'Save Changes' : 'Create Program'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  if (type === 'delete') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Program</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-bold text-foreground">{program?.name}</span>? 
              This is a top-level action and will orphan all associated courses, semesters, and student links. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form id="delete-form" onSubmit={onDelete}></form>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="delete-form" variant="destructive">Delete Program</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
