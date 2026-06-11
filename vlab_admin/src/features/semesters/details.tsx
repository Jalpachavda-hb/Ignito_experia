import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Users, FlaskConical, Database, CalendarIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { mockSemesters } from './data/mock-data'
import { Badge } from '@/components/ui/badge'

export default function SemesterDetailsView() {
  const { semesterId } = useParams({ from: '/_authenticated/semesters/$semesterId' })
  // Simulate fetching from mock data
  const semester = mockSemesters.find(s => s.id === semesterId) || mockSemesters[0]

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
            <Link to="/semesters">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Semesters
            </Link>
          </Button>
          <div className='flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
            <div>
              <div className="flex items-center gap-3">
                <h1 className='text-3xl font-bold tracking-tight text-primary'>{semester.name}</h1>
                <Badge variant={semester.status === 'active' ? 'default' : semester.status === 'upcoming' ? 'secondary' : 'outline'} className="capitalize">
                  {semester.status}
                </Badge>
              </div>
              <p className='text-muted-foreground mt-1 font-mono flex items-center gap-2'>
                {semester.courseName}
                <span>•</span>
                <CalendarIcon className="h-3.5 w-3.5" />
                {semester.startDate.toLocaleDateString()} - {semester.endDate.toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Print Roster</Button>
            </div>
          </div>
        </div>

        {/* Top Details Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Students</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{semester.studentsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Official roster count</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Labs</CardTitle>
              <FlaskConical className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{semester.labsAssigned}</div>
              <p className="text-xs text-muted-foreground mt-1">Virtual environments provisioned</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credit Allocation</CardTitle>
              <Database className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{semester.allocatedCredits.toLocaleString()} cr</div>
              <p className="text-xs text-muted-foreground mt-1">Total pool reserved</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
            <TabsTrigger value="students" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
              <Users className="h-4 w-4 mr-2" />
              Student Roster
            </TabsTrigger>
            <TabsTrigger value="labs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
              <FlaskConical className="h-4 w-4 mr-2" />
              Assigned Labs
            </TabsTrigger>
            <TabsTrigger value="credits" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
              <Database className="h-4 w-4 mr-2" />
              Credit Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="m-0 mt-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Enrolled Students ({semester.studentsCount})</CardTitle>
                <CardDescription>Manage the active student roster for {semester.name}.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                [Student Data Table Placeholder]
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="labs" className="m-0 mt-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Assigned Labs ({semester.labsAssigned})</CardTitle>
                <CardDescription>The practical environments available to students this semester.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                [Lab Listing Table Placeholder]
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="credits" className="m-0 mt-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Credit Allocation</CardTitle>
                <CardDescription>Manage the compute credit distribution rules for this term.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                [Credit Rules Form Placeholder]
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
