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
import { Eye, Edit, Trash, Users, FlaskConical, GraduationCap } from 'lucide-react'

interface CoursesKanbanProps {
  data: Course[]
}

export function CoursesKanban({ data }: CoursesKanbanProps) {
  const { setDialogOpen, setCurrentRow } = useCourses()

  const handleAction = (course: Course, action: 'edit' | 'delete' | 'assign-labs') => {
    setCurrentRow(course)
    setDialogOpen(action)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
      {data.map((course) => (
        <Card key={course.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col justify-between">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={course.status === 'active' ? 'default' : course.status === 'draft' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                  {course.status}
                </Badge>
                {course.program && (
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {course.program}
                  </Badge>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-6 w-6 p-0 -mt-1 -mr-1">
                    <DotsHorizontalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={`/courses/${course.id}`} className="flex items-center cursor-pointer">
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </a>
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
                <span>{course.studentsCount} Students</span>
              </div>
              <div className="flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5 text-emerald-500" />
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
  )
}

