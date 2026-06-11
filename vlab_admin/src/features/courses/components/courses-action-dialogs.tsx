import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { type Course } from '../data/schema'
import { useForm } from 'react-hook-form'

interface CourseActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'create' | 'edit' | 'delete' | 'assign-labs' | null
  course?: Course
}

export function CourseActionDialogs({ open, onOpenChange, type, course }: CourseActionDialogProps) {
  const isEdit = type === 'edit'
  
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: course?.name || '',
      code: course?.code || '',
      program: course?.program || 'Computer Science',
      semesters: course?.totalSemesters || 1,
    }
  })

  if (!type) return null

  const onSubmit = async (data: any) => {
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Saving...',
      success: () => `${isEdit ? 'Updated' : 'Created'} course successfully.`,
      error: 'Failed to save',
    })
  }

  const onDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Deleting course...',
      success: 'Course deleted successfully.',
      error: 'Failed to delete course',
    })
  }

  const onAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Assigning labs...',
      success: 'Labs assigned successfully.',
      error: 'Failed to assign labs',
    })
  }

  if (type === 'create' || type === 'edit') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Course' : 'Add New Course'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Modify the course details below.' : 'Fill in the details to add a new course to the curriculum.'}
            </DialogDescription>
          </DialogHeader>
          <form id="course-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Course Name</Label>
                <Input {...register('name')} placeholder="e.g. Advanced Networking" required />
              </div>
              <div className="space-y-2">
                <Label>Course Code</Label>
                <Input {...register('code')} placeholder="e.g. CS101" required />
              </div>
              <div className="space-y-2">
                <Label>Total Semesters</Label>
                <Input type="number" min={1} max={8} {...register('semesters')} required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Program</Label>
                <Select defaultValue={course?.program || 'Computer Science'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                    <SelectItem value="Data Science">Data Science</SelectItem>
                    <SelectItem value="Cloud Computing">Cloud Computing</SelectItem>
                    <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="course-form">{isEdit ? 'Save Changes' : 'Create Course'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  if (type === 'assign-labs') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Assign Labs to {course?.code}</DialogTitle>
            <DialogDescription>Select which virtual lab environments should be available for students enrolled in this course.</DialogDescription>
          </DialogHeader>
          <form id="assign-form" onSubmit={onAssign} className="pt-4 space-y-4">
            <div className="p-4 border rounded-md bg-muted/50 text-sm text-center text-muted-foreground">
              [Lab Multi-Select Component Placeholder]
              <br/>
              Simulating assignment.
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="assign-form">Save Assignments</Button>
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
            <DialogTitle className="text-destructive">Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-bold text-foreground">{course?.name}</span>? This action cannot be undone. All enrolled students will lose access to the assigned labs.
            </DialogDescription>
          </DialogHeader>
          <form id="delete-form" onSubmit={onDelete}></form>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="delete-form" variant="destructive">Delete Course</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
