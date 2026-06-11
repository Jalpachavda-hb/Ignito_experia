import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { type Semester } from '../data/schema'
import { useForm } from 'react-hook-form'

interface SemesterActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'create' | 'edit' | 'delete' | null
  semester?: Semester
}

export function SemesterActionDialogs({ open, onOpenChange, type, semester }: SemesterActionDialogProps) {
  const isEdit = type === 'edit'
  
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: semester?.name || '',
      courseId: semester?.courseId || '',
      startDate: semester?.startDate ? semester.startDate.toISOString().split('T')[0] : '',
      endDate: semester?.endDate ? semester.endDate.toISOString().split('T')[0] : '',
    }
  })

  if (!type) return null

  const onSubmit = async (data: any) => {
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Saving...',
      success: () => `${isEdit ? 'Updated' : 'Created'} semester successfully.`,
      error: 'Failed to save',
    })
  }

  const onDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Deleting semester...',
      success: 'Semester deleted successfully.',
      error: 'Failed to delete semester',
    })
  }

  if (type === 'create' || type === 'edit') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Semester' : 'Create New Semester'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Modify the term dates and details.' : 'Define a new academic term and link it to an existing course.'}
            </DialogDescription>
          </DialogHeader>
          <form id="semester-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Term Name</Label>
                <Input {...register('name')} placeholder="e.g. Fall 2026" required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Associated Course</Label>
                <Select defaultValue={semester?.courseId || 'mock-id-1'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock-id-1">CS101 Fundamentals</SelectItem>
                    <SelectItem value="mock-id-2">CYB400 Penetration Test</SelectItem>
                    <SelectItem value="mock-id-3">DS200 Data Science</SelectItem>
                    <SelectItem value="mock-id-4">CC301 Cloud Computing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...register('startDate')} required />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" {...register('endDate')} required />
              </div>
            </div>
          </form>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="semester-form">{isEdit ? 'Save Changes' : 'Create Semester'}</Button>
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
            <DialogTitle className="text-destructive">Delete Semester</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-bold text-foreground">{semester?.name}</span>? This will detach all students and labs associated with this specific term. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form id="delete-form" onSubmit={onDelete}></form>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="delete-form" variant="destructive">Delete Semester</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
