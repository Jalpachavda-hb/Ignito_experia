import { type Course } from '../data/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCourses } from '../context/courses-context'
import { Button } from '@/components/ui/button'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Link } from '@tanstack/react-router'
import { Eye, Edit, Trash, Users, FlaskConical } from 'lucide-react'

interface CoursesKanbanProps {
  data: Course[]
}

export function CoursesKanban({ data }: CoursesKanbanProps) {
  const { setDialogOpen, setCurrentRow } = useCourses()

  const handleAction = (course: Course, action: 'edit' | 'delete' | 'assign-labs') => {
    setCurrentRow(course)
    setDialogOpen(action)
  }

  // Group by Program
  const columns = [
    { id: 'Computer Science', title: 'Computer Science', color: 'bg-emerald-500/10 border-emerald-500/20' },
    { id: 'Cyber Security', title: 'Cyber Security', color: 'bg-red-500/10 border-red-500/20' },
    { id: 'Data Science', title: 'Data Science', color: 'bg-purple-500/10 border-purple-500/20' },
    { id: 'Cloud Computing', title: 'Cloud Computing', color: 'bg-sky-500/10 border-sky-500/20' },
    { id: 'Software Engineering', title: 'Software Engineering', color: 'bg-amber-500/10 border-amber-500/20' },
  ]

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {columns.map((col) => {
        const columnCourses = data.filter((course) => course.program === col.id)

        return (
          <div key={col.id} className="flex-shrink-0 w-[280px] flex flex-col gap-4">
            <div className={`rounded-md border p-3 flex items-center justify-between font-semibold ${col.color}`}>
              <span className="capitalize text-sm">{col.title}</span>
              <Badge variant="secondary" className="bg-background/50">{columnCourses.length}</Badge>
            </div>
            
            <div className="flex flex-col gap-4 flex-1">
              {columnCourses.map((course) => (
                <Card key={course.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow relative group">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant={course.status === 'active' ? 'default' : course.status === 'draft' ? 'secondary' : 'outline'} className="mb-2 text-[10px] capitalize">
                        {course.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-6 w-6 p-0 -mt-1 -mr-1">
                            <DotsHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/courses/${course.id}`} className="flex items-center cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(course, 'edit')}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Course
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(course, 'assign-labs')}>
                            <FlaskConical className="mr-2 h-4 w-4 text-emerald-500" />
                            Assign Labs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAction(course, 'delete')} className="text-destructive">
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-base line-clamp-2 leading-snug">{course.name}</CardTitle>
                    <div className="text-xs font-mono text-muted-foreground mt-1">{course.code}</div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{course.studentsCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FlaskConical className="h-3.5 w-3.5" />
                        <span>{course.labsAssigned} Labs</span>
                      </div>
                      <div className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {course.totalSemesters} Term{course.totalSemesters > 1 ? 's' : ''}
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
