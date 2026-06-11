import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrentCourse } from '../types'
import { Code, Database, Monitor } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

export function CurrentCourses({ courses }: { courses: CurrentCourse[] }) {
  
  // Custom styling to match the screenshot for the first 3 courses
  const getCourseStyle = (idx: number) => {
    switch(idx % 3) {
      case 0: return { icon: Code, color: 'text-red-500', bg: 'bg-red-50', bar: 'bg-red-500', track: 'bg-red-50' }
      case 1: return { icon: Database, color: 'text-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-500', track: 'bg-orange-50' }
      case 2: return { icon: Monitor, color: 'text-purple-500', bg: 'bg-purple-50', bar: 'bg-purple-500', track: 'bg-purple-50' }
      default: return { icon: Code, color: 'text-red-500', bg: 'bg-red-50', bar: 'bg-red-500', track: 'bg-red-50' }
    }
  }

  return (
    <Card className="border-border/60 shadow-sm h-full flex flex-col rounded-xl">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-foreground">Current Courses</CardTitle>
        <Button variant="outline" size="sm" className="h-8 text-xs px-4 rounded-lg font-semibold border-border/60">
          View All
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between space-y-6 pb-6">
        
        {courses.slice(0, 3).map((course, idx) => {
          const style = getCourseStyle(idx)
          return (
            <div key={course.id} className="flex items-center gap-4">
              {/* Icon */}
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${style.bg} ${style.color}`}>
                <style.icon className="h-5 w-5" />
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-foreground line-clamp-1">{course.subjectName}</h4>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Semester 3</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 px-3 text-[11px] font-semibold text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 rounded-full">
                    Continue
                  </Button>
                </div>
                
                <div className="flex items-center gap-3">
                  <Progress value={course.progressPercentage} className={`h-1 flex-1 ${style.track}`}>
                    <div 
                      className={`h-full transition-all ${style.bar}`} 
                      style={{ width: `${course.progressPercentage}%` }}
                    />
                  </Progress>
                  <span className="text-[11px] font-bold text-foreground w-8 text-right">{course.progressPercentage}%</span>
                </div>
              </div>
            </div>
          )
        })}

      </CardContent>
    </Card>
  )
}
