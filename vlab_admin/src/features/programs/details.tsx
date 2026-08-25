import { useState, useMemo, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { useParams, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Users,
  FlaskConical,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Plus,
  Search as SearchIcon,
  Filter,
  CheckCircle2,
  MoreHorizontal,
  Layers,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  Eye,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { mockPrograms, mockProgramCourses, type ProgramCourseItem } from './data/mock-data'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MapLabDialog } from './components/map-lab-dialog'
import { toast } from 'sonner'
import { getSemesterCourseListByProgrammeId } from '@/Utils/lmsApi_paths'

export default function ProgramDetailsView() {
  const params = useParams({ strict: false })
  const rawProgramId = params.programId || '2'

  // Resolve numeric LMS programmeId (e.g. 2 for MCA, 1 for MBA)
  const resolvedProgrammeId = useMemo(() => {
    if (!rawProgramId) return '2'
    const lower = String(rawProgramId).toLowerCase()
    if (lower.includes('mca') || lower === '2') return '2'
    if (lower.includes('mba') || lower === '1') return '1'
    const parsed = rawProgramId.replace(/\D/g, '')
    return parsed || '2'
  }, [rawProgramId])

  // Find target program or default to MCA
  const program = mockPrograms.find((p) => p.id === rawProgramId || p.code.toLowerCase() === rawProgramId.toLowerCase()) || {
    id: resolvedProgrammeId,
    name: 'Master of Computer Applications',
    code: 'MCAOL',
    degree: 'Masters',
    durationYears: 2,
    totalCourses: 12,
    totalSemesters: 4,
    totalStudents: 150,
    totalLabs: 8,
    status: 'active'
  }

  // LMS State
  const [lmsSemesters, setLmsSemesters] = useState<any[]>([])
  const [lmsCourses, setLmsCourses] = useState<any[]>([])
  const [isLmsLoading, setIsLmsLoading] = useState(false)

  // State for courses data (allowing live update when lab is mapped)
  const [coursesData, setCoursesData] = useState<ProgramCourseItem[]>(mockProgramCourses)

  // Filter state (default to 'all' or '1' to show active courses immediately)
  const [selectedSemester, setSelectedSemester] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')

  // Map Lab dialog state
  const [mapLabOpen, setMapLabOpen] = useState(false)
  const [selectedCourseForMap, setSelectedCourseForMap] = useState<ProgramCourseItem | null>(null)

  // Fetch API No 3: GetSemesterCourseListByProgrammeId
  useEffect(() => {
    setIsLmsLoading(true)
    console.log(`[ProgramDetails] Fetching GetSemesterCourseListByProgrammeId for programmeId=${resolvedProgrammeId}`)

    getSemesterCourseListByProgrammeId(resolvedProgrammeId)
      .then((res: any) => {
        const sems = res?.semesterList || res?.rawData?.semesterList || []
        const courses = res?.courseList || res?.courselist || res?.rawData?.courseList || res?.rawData?.courselist || []

        if (sems && sems.length > 0) setLmsSemesters(sems)
        if (courses && courses.length > 0) setLmsCourses(courses)
      })
      .catch((err: any) => {
        console.error("Failed to fetch semester course list by programmeId:", err)
      })
      .finally(() => {
        setIsLmsLoading(false)
      })
  }, [resolvedProgrammeId])

  // Generate dynamic semesters array from LMS response or totalSemesters
  const semesterList = useMemo(() => {
    if (lmsSemesters && lmsSemesters.length > 0) {
      return lmsSemesters.map((s: any) => ({
        num: s.semesterNumber || s.semesterId,
        id: String(s.semesterNumber || s.semesterId),
        semesterId: String(s.semesterId || s.semesterNumber),
        name: `Sem ${s.semesterNumber || s.semesterId}`,
      }))
    }

    const count = program.totalSemesters || 4
    return Array.from({ length: count }, (_, i) => ({
      num: i + 1,
      id: `${i + 1}`,
      semesterId: `${i + 1}`,
      name: `Sem ${i + 1}`,
    }))
  }, [lmsSemesters, program.totalSemesters])

  // Get courses belonging to this program from LMS or mock fallback
  const programCourses = useMemo(() => {
    if (lmsCourses && lmsCourses.length > 0) {
      return lmsCourses.map((c: any, idx: number) => ({
        id: String(c.programCourseId || c.courseDetailsId || c.courseId || idx + 1),
        name: c.courseName || c.name || 'Course',
        code: c.courseCode || c.code || `COURSE-${idx + 1}`,
        programId: String(program.id),
        programCode: program.code,
        semesterNumber: c.semesterNumber || (selectedSemester !== 'all' ? Number(selectedSemester) : 1),
        semesterId: c.semesterId || (selectedSemester !== 'all' ? selectedSemester : '1'),
        semesterName: `Sem ${c.semesterNumber || (selectedSemester !== 'all' ? selectedSemester : '1')}`,
        program: program.code || 'MCA',
        totalSemesters: program.totalSemesters || 4,
        studentsCount: c.studentsCount || 50,
        credits: c.practicalCredit || c.credits || 4,
        mappedLabTitle: c.mappedLab?.title || (c.mappedLab ? 'Mapped Lab' : null),
        labsAssigned: c.mappedLab ? 1 : 0,
        status: (c.isElectiveCourse ? 'elective' : 'active') as any,
        description: c.courseDescprition || c.description || ''
      }))
    }

    return []
  }, [lmsCourses, program, selectedSemester])

  // Filter courses by selected semester, search query & status
  const filteredCourses = useMemo(() => {
    return programCourses.filter((course) => {
      const matchesSemester =
        selectedSemester === 'all' ||
        String(course.semesterNumber) === String(selectedSemester) ||
        String(course.semesterId) === String(selectedSemester)

      const matchesSearch =
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.code.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || course.status === statusFilter

      return matchesSemester && matchesSearch && matchesStatus
    })
  }, [programCourses, selectedSemester, searchQuery, statusFilter])

  // Handle opening Map Lab modal
  const handleOpenMapLab = (course: ProgramCourseItem) => {
    setSelectedCourseForMap(course)
    setMapLabOpen(true)
  }

  // Handle live update of lab count & title when saved in MapLabDialog
  const handleLabsUpdated = (newCount: number, mappedLabTitle?: string) => {
    if (!selectedCourseForMap) return
    setLmsCourses((prev) =>
      prev.map((c) => {
        const idMatches = String(c.programCourseId || c.courseDetailsId || c.courseId || c.id) === String(selectedCourseForMap.id) ||
                          String(c.courseCode || c.code) === String(selectedCourseForMap.code)
        return idMatches
          ? {
              ...c,
              mappedLab: {
                ...(c.mappedLab || {}),
                title: mappedLabTitle || 'Mapped Lab',
                status: 'active'
              }
            }
          : c
      })
    )
  }

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='bg-muted/10 pb-12'>
        {/* Navigation Back Button & Title Header */}
        <div className='mb-6'>
          <Button variant='link' asChild className='px-0 text-muted-foreground mb-2 h-auto hover:text-primary'>
            <Link to='/programs'>
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back to Program Management
            </Link>
          </Button>

          <div className='flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
            <div>
              <div className='flex items-center gap-3 flex-wrap'>
                <h1 className='text-3xl font-bold tracking-tight text-foreground'>{program.name}</h1>
                <Badge variant='secondary' className='font-mono text-xs px-2.5 py-0.5'>
                  {program.code}
                </Badge>
                <Badge
                  variant={program.status === 'active' ? 'default' : 'outline'}
                  className='capitalize shadow-2xs'
                >
                  {program.status}
                </Badge>
              </div>

              <p className='text-muted-foreground mt-1 text-sm flex items-center gap-2 flex-wrap'>
                <span className='flex items-center gap-1.5 font-medium'>
                  <GraduationCap className='h-4 w-4 text-primary' />
                  {program.degree} Degree
                </span>
                <span>•</span>
                <span className='flex items-center gap-1.5'>
                  <CalendarDays className='h-4 w-4 text-amber-500' />
                  {program.durationYears} Years ({program.totalSemesters} Semesters)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* KPI Metrics Row */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <Card className='border-border/60 shadow-xs relative overflow-hidden bg-card'>
            <CardContent className='p-4 flex items-center justify-between'>
              <div>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                  Total Semesters
                </p>
                <h3 className='text-2xl font-bold mt-0.5 text-foreground'>{program.totalSemesters} Terms</h3>
              </div>
              <div className='h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center'>
                <Layers className='h-5 w-5' />
              </div>
            </CardContent>
          </Card>

          <Card className='border-border/60 shadow-xs relative overflow-hidden bg-card'>
            <CardContent className='p-4 flex items-center justify-between'>
              <div>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                  Total Courses
                </p>
                <h3 className='text-2xl font-bold mt-0.5 text-primary'>{programCourses.length} Courses</h3>
              </div>
              <div className='h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center'>
                <BookOpen className='h-5 w-5' />
              </div>
            </CardContent>
          </Card>

          <Card className='border-border/60 shadow-xs relative overflow-hidden bg-card'>
            <CardContent className='p-4 flex items-center justify-between'>
              <div>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                  Enrolled Students
                </p>
                <h3 className='text-2xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400'>
                  {program.totalStudents?.toLocaleString() ?? 0}
                </h3>
              </div>
              <div className='h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center'>
                <Users className='h-5 w-5' />
              </div>
            </CardContent>
          </Card>

          <Card className='border-border/60 shadow-xs relative overflow-hidden bg-card'>
            <CardContent className='p-4 flex items-center justify-between'>
              <div>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                  Assigned Labs
                </p>
                <h3 className='text-2xl font-bold mt-0.5 text-purple-600 dark:text-purple-400'>
                  {programCourses.reduce((acc, c) => acc + c.labsAssigned, 0)} Labs
                </h3>
              </div>
              <div className='h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center'>
                <FlaskConical className='h-5 w-5' />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- SEMESTER SELECTION TABS --- */}
        <div className='mb-6 bg-card border border-border/60 rounded-xl p-3 shadow-2xs'>
          <div className='flex items-center justify-between mb-2 px-1'>
            <h2 className='text-sm font-semibold text-foreground flex items-center gap-2'>
              <Layers className='h-4 w-4 text-primary' />
              Select Semester / Academic Term
            </h2>
            <span className='text-xs text-muted-foreground'>
              Showing {filteredCourses.length} course(s)
            </span>
          </div>

          <div className='flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none'>
            {/* All Semesters option */}
            <button
              type='button'
              onClick={() => setSelectedSemester('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${selectedSemester === 'all'
                  ? 'bg-[#c5192d] text-white shadow-xs font-semibold'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
              <span>All Semesters</span>
              <Badge
                variant={selectedSemester === 'all' ? 'secondary' : 'outline'}
                className={`text-[10px] px-1.5 py-0 h-4 ${selectedSemester === 'all' ? 'bg-white/20 text-white border-transparent' : ''
                  }`}
              >
                {programCourses.length}
              </Badge>
            </button>

            {/* Individual Semester Tabs */}
            {semesterList.map((sem) => {
              const semCoursesCount = programCourses.filter(
                (c) => c.semesterNumber.toString() === sem.id
              ).length

              const isSelected = selectedSemester === sem.id

              return (
                <button
                  key={sem.id}
                  type='button'
                  onClick={() => setSelectedSemester(sem.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${isSelected
                      ? 'bg-[#c5192d] text-white shadow-xs font-semibold'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  <span>{sem.name}</span>
                  <Badge
                    variant={isSelected ? 'secondary' : 'outline'}
                    className={`text-[10px] px-1.5 py-0 h-4 ${isSelected ? 'bg-white/20 text-white border-transparent' : ''
                      }`}
                  >
                    {semCoursesCount}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>

        {/* --- COURSES TABLE SECTION (Matching Image 2 UI Structure) --- */}
        <div className='bg-card border border-border/60 rounded-xl shadow-xs overflow-hidden'>
          {/* Table Header Controls */}
          <div className='p-4 border-b border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/10'>
            <div className='flex items-center gap-3 flex-1 max-w-md'>
              <div className='relative flex-1'>
                <SearchIcon className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search courses by name or code...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-9 bg-background shadow-2xs text-xs sm:text-sm'
                />
              </div>

              {/* Status Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='gap-1.5 text-xs shadow-2xs shrink-0'>
                    <Filter className='h-3.5 w-3.5 text-muted-foreground' />
                    Status: <span className='capitalize font-semibold'>{statusFilter}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-40'>
                  <DropdownMenuLabel className='text-xs'>Filter Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter('all')}>All Statuses</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('active')}>Active</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('draft')}>Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('archived')}>Archived</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* View Mode Switcher */}
            <div className='flex items-center gap-1 self-end sm:self-auto bg-muted/40 p-1 rounded-lg border border-border/40'>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size='sm'
                onClick={() => setViewMode('table')}
                className='h-7 px-2.5 text-xs gap-1'
              >
                <List className='h-3.5 w-3.5' />
                Table View
              </Button>
              <Button
                variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                size='sm'
                onClick={() => setViewMode('board')}
                className='h-7 px-2.5 text-xs gap-1'
              >
                <LayoutGrid className='h-3.5 w-3.5' />
                Board View
              </Button>
            </div>
          </div>

          {/* TABLE VIEW */}
          {viewMode === 'table' ? (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-muted/30 hover:bg-muted/30'>
                    <TableHead className='font-semibold text-xs text-foreground uppercase tracking-wider w-[260px]'>
                      Course Details
                    </TableHead>
                    <TableHead className='font-semibold text-xs text-foreground uppercase tracking-wider'>
                      Program
                    </TableHead>
                    <TableHead className='font-semibold text-xs text-foreground uppercase tracking-wider'>
                      Semesters
                    </TableHead>
                    <TableHead className='font-semibold text-xs text-foreground uppercase tracking-wider'>
                      Enrollment
                    </TableHead>
                    <TableHead className='font-semibold text-xs text-foreground uppercase tracking-wider'>
                      Assigned Labs
                    </TableHead>
                    <TableHead className='font-semibold text-xs text-foreground uppercase tracking-wider'>
                      Status
                    </TableHead>
                    <TableHead className='font-semibold text-xs text-foreground uppercase tracking-wider text-right pr-6'>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredCourses.length > 0 ? (
                    filteredCourses.map((course) => (
                      <TableRow key={course.id} className='group hover:bg-muted/20 transition-colors'>
                        {/* Course Details Column (Name & Code in red styled tone matching Image 2) */}
                        <TableCell className='py-3.5'>
                          <div className='flex flex-col'>
                            <span className='font-semibold text-red-600 dark:text-red-400 group-hover:underline cursor-pointer text-sm'>
                              {course.name}
                            </span>
                            <span className='text-xs text-muted-foreground font-mono mt-0.5'>
                              {course.code}
                            </span>
                          </div>
                        </TableCell>

                        {/* Program Badge */}
                        <TableCell>
                          <Badge variant='secondary' className='gap-1 font-normal text-xs px-2 py-0.5'>
                            <GraduationCap className='h-3 w-3 text-muted-foreground' />
                            {course.program}
                          </Badge>
                        </TableCell>

                        {/* Semesters Column */}
                        <TableCell className='text-sm text-foreground/80 font-medium'>
                          {course.semesterName} ({course.totalSemesters} Terms)
                        </TableCell>

                        {/* Enrollment Column */}
                        <TableCell>
                          <div className='flex items-center gap-1.5 text-sm text-foreground/90'>
                            <Users className='h-4 w-4 text-muted-foreground' />
                            <span>{course.studentsCount}</span>
                          </div>
                        </TableCell>

                        {/* Assigned Labs Column */}
                        <TableCell>
                          {course.mappedLabTitle ? (
                            <Badge variant='outline' className='gap-1.5 text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'>
                              <FlaskConical className='h-3.5 w-3.5 text-purple-600 dark:text-purple-400' />
                              <span>{course.mappedLabTitle}</span>
                            </Badge>
                          ) : (
                            <Badge variant='outline' className='gap-1 text-xs font-normal text-muted-foreground bg-muted/30 px-2 py-0.5 border-dashed'>
                              No Lab Mapped
                            </Badge>
                          )}
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell>
                          <Badge
                            variant={course.status === 'active' ? 'default' : 'outline'}
                            className='capitalize text-[11px]'
                          >
                            {course.status}
                          </Badge>
                        </TableCell>

                        {/* Action Column with Light Red Map Lab Button! */}
                        <TableCell className='text-right pr-6 py-3.5'>
                          <div className='flex items-center justify-end gap-2'>
                            {/* Prominent MAP LAB Button in Crimson Red (matching primary buttons across UI) */}
                            <Button
                              size='sm'
                              onClick={() => handleOpenMapLab(course)}
                              className='gap-1.5 h-8 px-3 text-xs bg-[#c5192d] hover:bg-[#a81426] text-white shadow-xs font-medium cursor-pointer transition-transform hover:scale-[1.02]'
                            >
                              <FlaskConical className='h-3.5 w-3.5' />
                              Map Lab
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className='h-32 text-center text-muted-foreground'>
                        <div className='flex flex-col items-center justify-center gap-1'>
                          <BookOpen className='h-8 w-8 text-muted-foreground/50' />
                          <p className='font-medium text-sm text-foreground mt-1'>
                            No courses found for {selectedSemester === 'all' ? 'this program' : `Sem ${selectedSemester}`}.
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Try changing your search query or semester tab.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* BOARD / GRID VIEW */
            <div className='p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {filteredCourses.map((course) => (
                <Card key={course.id} className='border-border/60 hover:border-primary/40 shadow-2xs transition-all'>
                  <CardContent className='p-4 space-y-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <div>
                        <h4 className='font-bold text-sm text-primary'>{course.name}</h4>
                        <p className='text-xs font-mono text-muted-foreground mt-0.5'>{course.code}</p>
                      </div>
                      <Badge variant={course.status === 'active' ? 'default' : 'outline'} className='text-[10px]'>
                        {course.status}
                      </Badge>
                    </div>

                    <div className='flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40'>
                      <span className='flex items-center gap-1'>
                        <GraduationCap className='h-3.5 w-3.5' /> {course.program}
                      </span>
                      <span>•</span>
                      <span className='flex items-center gap-1'>
                        <Users className='h-3.5 w-3.5' /> {course.studentsCount} Students
                      </span>
                    </div>

                    <div className='flex items-center justify-between pt-2 border-t border-border/40'>
                      <div className='flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400'>
                        <FlaskConical className='h-4 w-4' />
                        {course.labsAssigned} Labs Assigned
                      </div>

                      <Button
                        size='sm'
                        onClick={() => handleOpenMapLab(course)}
                        className='gap-1 h-7 text-xs bg-[#c5192d] hover:bg-[#a81426] text-white shadow-2xs font-medium cursor-pointer'
                      >
                        <FlaskConical className='h-3 w-3' />
                        Map Lab
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Main>

      {/* MAP LAB MODAL DIALOG */}
      {selectedCourseForMap && (
        <MapLabDialog
          open={mapLabOpen}
          onOpenChange={setMapLabOpen}
          courseName={selectedCourseForMap.name}
          courseCode={selectedCourseForMap.code}
          programId={resolvedProgrammeId}
          semesterId={selectedSemester !== 'all' ? selectedSemester : '1'}
          currentLabsCount={selectedCourseForMap.labsAssigned}
          onLabsUpdated={handleLabsUpdated}
        />
      )}
    </>
  )
}
