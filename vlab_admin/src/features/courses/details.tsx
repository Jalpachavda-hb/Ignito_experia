import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Users, FlaskConical, CalendarDays, LineChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { mockCourses, mockCourseAnalytics } from './data/mock-data'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

export default function CourseDetailsView() {
  const { courseId } = useParams({ from: '/_authenticated/courses/$courseId' })
  // Simulate fetching from mock data (in reality this would be an API call)
  const course = mockCourses.find(c => c.id === courseId) || mockCourses[0]

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main>
        <div className='mb-6'>
          <Button variant="link" asChild className="px-0 text-muted-foreground mb-2">
            <Link to="/courses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Link>
          </Button>
          <div className='flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
            <div>
              <h1 className='text-3xl font-bold tracking-tight text-primary'>{course.name}</h1>
              <p className='text-muted-foreground mt-1 font-mono'>
                {course.code} • {course.program}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Edit Syllabus</Button>
              <Button>Generate Report</Button>
            </div>
          </div>
        </div>

        {/* Top Analytics Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Enrollment</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{course.studentsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">+12% from last semester</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Labs</CardTitle>
              <FlaskConical className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{course.labsAssigned}</div>
              <p className="text-xs text-muted-foreground mt-1">Total practical modules</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Curriculum Length</CardTitle>
              <CalendarDays className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{course.totalSemesters}</div>
              <p className="text-xs text-muted-foreground mt-1">Semesters (Terms)</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="analytics" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
            <TabsTrigger value="analytics" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
              <LineChart className="h-4 w-4 mr-2" />
              Usage Analytics
            </TabsTrigger>
            <TabsTrigger value="labs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
              <FlaskConical className="h-4 w-4 mr-2" />
              Assigned Labs
            </TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
              <Users className="h-4 w-4 mr-2" />
              Enrolled Students
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="m-0 mt-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Lab Hours Consumed (Last 14 Days)</CardTitle>
                <CardDescription>Aggregate compute hours utilized by students in {course.code}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockCourseAnalytics} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      />
                      <Area type="monotone" dataKey="labHoursConsumed" name="Hours Consumed" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="labs" className="m-0 mt-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Assigned Labs</CardTitle>
                <CardDescription>The practical environments available to students in this course.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                Lab Listing Table Placeholder
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="m-0 mt-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Enrolled Students</CardTitle>
                <CardDescription>Manage the roster for the current semester.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                Student Data Table Placeholder
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
