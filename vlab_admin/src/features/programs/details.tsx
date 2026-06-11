import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Users, FlaskConical, Network, GraduationCap, BookOpen, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { mockPrograms } from './data/mock-data'
import { Badge } from '@/components/ui/badge'

export default function ProgramDetailsView() {
  const { programId } = useParams({ from: '/_authenticated/programs/$programId' })
  // Simulate fetching from mock data
  const program = mockPrograms.find(p => p.id === programId) || mockPrograms[0]

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main className="bg-muted/10">
        <div className='mb-6'>
          <Button variant="link" asChild className="px-0 text-muted-foreground mb-2">
            <Link to="/programs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Programs
            </Link>
          </Button>
          <div className='flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
            <div>
              <div className="flex items-center gap-3">
                <h1 className='text-3xl font-bold tracking-tight text-primary'>{program.name}</h1>
                <Badge variant={program.status === 'active' ? 'default' : 'outline'} className="capitalize">
                  {program.status}
                </Badge>
              </div>
              <p className='text-muted-foreground mt-1 font-mono flex items-center gap-2'>
                {program.code}
                <span>•</span>
                <GraduationCap className="h-3.5 w-3.5" />
                {program.degree} Degree
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Export Architecture</Button>
            </div>
          </div>
        </div>

        {/* Hierarchy Visualization Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
          
          {/* Main Visualizer (Left 3 cols) */}
          <Card className="lg:col-span-3 border-border/50 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
             
             <CardHeader className="pb-8">
               <CardTitle className="flex items-center text-xl">
                 <Network className="mr-2 h-5 w-5 text-primary" />
                 Academic Hierarchy Mapping
               </CardTitle>
               <CardDescription>
                 Visual representation of the structural hierarchy for {program.code}.
               </CardDescription>
             </CardHeader>
             
             <CardContent className="px-8 pb-12">
               
               {/* Step 1: Program */}
               <div className="flex flex-col items-center">
                 <div className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg shadow-md border flex flex-col items-center w-64 z-10 transition-transform hover:scale-105 cursor-pointer">
                    <GraduationCap className="h-6 w-6 mb-1 opacity-80" />
                    <span className="text-sm font-medium opacity-80">Root Program</span>
                    <span>{program.code}</span>
                 </div>
                 
                 {/* Connector line */}
                 <div className="w-0.5 h-10 bg-border relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full border">
                      Contains {program.totalCourses} Courses
                    </div>
                 </div>
                 
                 {/* Step 2: Course */}
                 <div className="bg-card text-card-foreground font-bold px-6 py-3 rounded-lg shadow-md border-2 border-emerald-500/30 flex flex-col items-center w-64 z-10 transition-transform hover:scale-105 cursor-pointer">
                    <BookOpen className="h-6 w-6 mb-1 text-emerald-500" />
                    <span className="text-sm font-medium text-muted-foreground">Course Level</span>
                    <span>Curriculums</span>
                 </div>
                 
                 {/* Connector line */}
                 <div className="w-0.5 h-10 bg-border relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full border">
                      Split into {program.durationYears * 2} Semesters
                    </div>
                 </div>
                 
                 {/* Step 3: Semester */}
                 <div className="bg-card text-card-foreground font-bold px-6 py-3 rounded-lg shadow-md border-2 border-amber-500/30 flex flex-col items-center w-64 z-10 transition-transform hover:scale-105 cursor-pointer">
                    <CalendarDays className="h-6 w-6 mb-1 text-amber-500" />
                    <span className="text-sm font-medium text-muted-foreground">Semester Level</span>
                    <span>Time-bound Terms</span>
                 </div>
                 
                 {/* Connector line */}
                 <div className="w-0.5 h-10 bg-border relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full border">
                      Enrolls {program.totalStudents.toLocaleString()} Students
                    </div>
                 </div>
                 
                 {/* Step 4: Students / Labs */}
                 <div className="flex gap-12 w-full max-w-md relative justify-center">
                    {/* Horizontal fork line */}
                    <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-border -mt-[2px] z-0"></div>
                    
                    {/* Left node */}
                    <div className="flex flex-col items-center relative">
                      <div className="w-0.5 h-6 bg-border"></div>
                      <div className="bg-card text-card-foreground font-bold px-4 py-3 rounded-lg shadow-md border-2 border-sky-500/30 flex flex-col items-center w-40 z-10 transition-transform hover:scale-105 cursor-pointer">
                          <Users className="h-5 w-5 mb-1 text-sky-500" />
                          <span className="text-xs font-medium text-muted-foreground">Leaf Node</span>
                          <span>Students</span>
                      </div>
                    </div>
                    
                    {/* Right node */}
                    <div className="flex flex-col items-center relative">
                      <div className="w-0.5 h-6 bg-border"></div>
                      <div className="bg-card text-card-foreground font-bold px-4 py-3 rounded-lg shadow-md border-2 border-purple-500/30 flex flex-col items-center w-40 z-10 transition-transform hover:scale-105 cursor-pointer">
                          <FlaskConical className="h-5 w-5 mb-1 text-purple-500" />
                          <span className="text-xs font-medium text-muted-foreground">Leaf Node</span>
                          <span>Virtual Labs</span>
                      </div>
                    </div>
                 </div>
                 
               </div>
             </CardContent>
          </Card>

          {/* Right Sidebar Stats (1 col) */}
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm relative overflow-hidden h-full">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-tl-full blur-2xl pointer-events-none"></div>
              <CardHeader>
                <CardTitle>Program Metrics</CardTitle>
                <CardDescription>Aggregated totals for {program.code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1 text-muted-foreground">
                    <span className="flex items-center"><BookOpen className="mr-2 h-4 w-4" /> Courses</span>
                    <span className="font-medium text-foreground">{program.totalCourses}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[70%]"></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between text-sm mb-1 text-muted-foreground">
                    <span className="flex items-center"><CalendarDays className="mr-2 h-4 w-4" /> Semesters</span>
                    <span className="font-medium text-foreground">{program.totalSemesters}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[40%]"></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1 text-muted-foreground">
                    <span className="flex items-center"><Users className="mr-2 h-4 w-4" /> Students</span>
                    <span className="font-medium text-foreground">{program.totalStudents.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 w-[85%]"></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1 text-muted-foreground">
                    <span className="flex items-center"><FlaskConical className="mr-2 h-4 w-4" /> Labs Assigned</span>
                    <span className="font-medium text-foreground">{program.totalLabs}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-[60%]"></div>
                  </div>
                </div>
                
                <div className="pt-6 mt-6 border-t border-border/50 text-xs text-muted-foreground text-center">
                  Created on {program.createdAt.toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </Main>
    </>
  )
}
