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
  Search as SearchIcon,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { type Program, type ProgramCourseItem } from './data/schema'
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
import { getPracticalAvailablePrograms, getSemesterCourseListByProgrammeId } from '@/Utils/lmsApi_paths'
import { extractProgramList, findLmsProgram, mapLmsProgram } from './data/map-lms-program'

function extractSemesterList(res: any): any[] {
  return res?.semesterList || res?.rawData?.semesterList || []
}

function extractCourseList(res: any): any[] {
  const nested: any[] = []
  const semesters = extractSemesterList(res)
  for (const sem of semesters) {
    nested.push(...(sem?.courseList || sem?.courselist || []))
  }
  const flat = res?.courseList || res?.courselist || res?.rawData?.courseList || res?.rawData?.courselist || []
  return flat.length ? flat : nested
}

export default function ProgramDetailsView() {
  const params = useParams({ strict: false })
  const rawProgramId = String(params.programId || '')

  const [program, setProgram] = useState<Program | null>(null)
  const [lmsSemesters, setLmsSemesters] = useState<any[]>([])
  const [lmsCourses, setLmsCourses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedSemester, setSelectedSemester] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')

  const [mapLabOpen, setMapLabOpen] = useState(false)
  const [selectedCourseForMap, setSelectedCourseForMap] = useState<ProgramCourseItem | null>(null)

  const [programmeIdForCourses, setProgrammeIdForCourses] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setLmsSemesters([])
    setLmsCourses([])
    setProgrammeIdForCourses('')

    ;(async () => {
      try {
        const programsRes: any = await getPracticalAvailablePrograms()
        if (cancelled) return
        const list = extractProgramList(programsRes)
        const found = findLmsProgram(list, rawProgramId)
        const mapped = found ? mapLmsProgram(found) : null
        setProgram(mapped)

        const courseProgrammeId = String(
          mapped?.id || mapped?.rawLmsData?.programId || (/^\d+$/.test(rawProgramId) ? rawProgramId : '')
        )
        setProgrammeIdForCourses(courseProgrammeId)

        if (!mapped && !courseProgrammeId) {
          setError('Program not found in LMS catalogue')
          return
        }

        if (!courseProgrammeId) {
          setError('Program is missing a numeric LMS programmeId')
          return
        }

        const coursesRes: any = await getSemesterCourseListByProgrammeId(courseProgrammeId)
        if (cancelled) return
        setLmsSemesters(extractSemesterList(coursesRes))
        setLmsCourses(extractCourseList(coursesRes))
      } catch (err: any) {
        console.error('Failed to load program details:', err)
        if (!cancelled) {
          setProgram(null)
          setError(err?.message || 'Failed to load program')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rawProgramId])

  const semesterList = useMemo(() => {
    return (lmsSemesters || [])
      .map((s: any) => ({
        num: Number(s.semesterNumber ?? s.semesterId),
        id: String(s.semesterNumber ?? ''),
        semesterId: String(s.semesterId ?? s.semesterNumber ?? ''),
        name: `Sem ${s.semesterNumber ?? s.semesterId}`,
      }))
      .filter((s) => s.id || s.semesterId)
  }, [lmsSemesters])

  const programCourses = useMemo<ProgramCourseItem[]>(() => {
    if (!program || !lmsCourses.length) return []
    return lmsCourses.map((c: any, idx: number) => {
      const semesterNumber = Number(c.semesterNumber ?? 0)
      const semesterId = String(c.semesterId ?? '')
      const mapped = Boolean(c.mappedLab)
      return {
        id: String(c.programCourseId || c.courseDetailsId || c.courseId || idx + 1),
        name: c.courseName || c.name || 'Course',
        code: c.courseCode || c.code || '',
        programId: String(program.id),
        programCode: program.code,
        semesterNumber,
        semesterId,
        semesterName: `Sem ${semesterNumber || semesterId}`,
        program: program.code,
        totalSemesters: program.totalSemesters || semesterList.length,
        studentsCount: Number.isFinite(Number(c.studentsCount)) ? Number(c.studentsCount) : undefined,
        mappedLabTitle: c.mappedLab?.title || (mapped ? 'Mapped Lab' : null),
        labsAssigned: mapped ? 1 : 0,
        status: (c.isElectiveCourse ? 'elective' : 'active') as ProgramCourseItem['status'],
        description: c.courseDescription || c.courseDescprition || c.description || '',
        courseType: c.courseType || '',
      }
    })
  }, [lmsCourses, program, semesterList.length])

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

  const handleOpenMapLab = (course: ProgramCourseItem) => {
    setSelectedCourseForMap(course)
    setMapLabOpen(true)
  }

  const handleLabsUpdated = (_newCount: number, mappedLabTitle?: string) => {
    if (!selectedCourseForMap) return
    setLmsCourses((prev) =>
      prev.map((c) => {
        const idMatches =
          String(c.programCourseId || c.courseDetailsId || c.courseId || c.id) === String(selectedCourseForMap.id) ||
          String(c.courseCode || c.code) === String(selectedCourseForMap.code)
        return idMatches
          ? {
              ...c,
              mappedLab: {
                ...(c.mappedLab || {}),
                title: mappedLabTitle || 'Mapped Lab',
                status: 'active',
              },
            }
          : c
      })
    )
  }

  const assignedLabs = programCourses.reduce((acc, c) => acc + c.labsAssigned, 0)

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
        <div className='mb-6'>
          <Button variant='link' asChild className='px-0 text-muted-foreground mb-2 h-auto hover:text-primary'>
            <Link to='/programs'>
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back to Program Management
            </Link>
          </Button>

          {program ? (
            <div className='flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
              <div>
                <div className='flex items-center gap-3 flex-wrap'>
                  <h1 className='text-3xl font-bold tracking-tight text-foreground'>{program.name}</h1>
                  {program.code ? (
                    <Badge variant='secondary' className='font-mono text-xs px-2.5 py-0.5'>
                      {program.code}
                    </Badge>
                  ) : null}
                  <Badge
                    variant={program.status === 'active' ? 'default' : 'outline'}
                    className='capitalize shadow-2xs'
                  >
                    {program.status}
                  </Badge>
                </div>

                <p className='text-muted-foreground mt-1 text-sm flex items-center gap-2 flex-wrap'>
                  {program.degree ? (
                    <span className='flex items-center gap-1.5 font-medium'>
                      <GraduationCap className='h-4 w-4 text-primary' />
                      {program.degree} Degree
                    </span>
                  ) : null}
                  {(program.durationText || program.durationYears || program.totalSemesters) ? (
                    <>
                      {program.degree ? <span>•</span> : null}
                      <span className='flex items-center gap-1.5'>
                        <CalendarDays className='h-4 w-4 text-amber-500' />
                        {program.durationText || (program.durationYears ? `${program.durationYears} Years` : '')}
                        {program.totalSemesters != null ? ` (${program.totalSemesters} Semesters)` : ''}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          ) : (
            <h1 className='text-3xl font-bold tracking-tight text-foreground'>
              {isLoading ? 'Loading program...' : 'Program'}
            </h1>
          )}
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <Card className='border-border/60 shadow-xs relative overflow-hidden bg-card'>
            <CardContent className='p-4 flex items-center justify-between'>
              <div>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                  Total Semesters
                </p>
                <h3 className='text-2xl font-bold mt-0.5 text-foreground'>
                  {isLoading ? '—' : `${semesterList.length || program?.totalSemesters || 0} Terms`}
                </h3>
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
                <h3 className='text-2xl font-bold mt-0.5 text-primary'>
                  {isLoading ? '—' : `${programCourses.length} Courses`}
                </h3>
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
                  {program?.totalStudents != null ? program.totalStudents.toLocaleString() : '—'}
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
                  {isLoading ? '—' : `${assignedLabs} Labs`}
                </h3>
              </div>
              <div className='h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center'>
                <FlaskConical className='h-5 w-5' />
              </div>
            </CardContent>
          </Card>
        </div>

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

            {semesterList.map((sem) => {
              const semCoursesCount = programCourses.filter(
                (c) =>
                  String(c.semesterNumber) === String(sem.id) ||
                  String(c.semesterId) === String(sem.semesterId)
              ).length
              const isSelected = selectedSemester === sem.id || selectedSemester === sem.semesterId

              return (
                <button
                  key={sem.semesterId || sem.id}
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

        <div className='bg-card border border-border/60 rounded-xl shadow-xs overflow-hidden'>
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
                  <DropdownMenuItem onClick={() => setStatusFilter('elective')}>Elective</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('draft')}>Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('archived')}>Archived</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

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
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className='h-32 text-center text-muted-foreground'>
                        <div className='flex items-center justify-center gap-2'>
                          <Loader2 className='h-5 w-5 animate-spin text-primary' />
                          <span className='text-sm'>Loading courses from LMS...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : error && !programCourses.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className='h-32 text-center text-muted-foreground'>
                        <p className='font-medium text-sm text-foreground'>{error}</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredCourses.length > 0 ? (
                    filteredCourses.map((course) => (
                      <TableRow key={course.id} className='group hover:bg-muted/20 transition-colors'>
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

                        <TableCell>
                          <Badge variant='secondary' className='gap-1 font-normal text-xs px-2 py-0.5'>
                            <GraduationCap className='h-3 w-3 text-muted-foreground' />
                            {course.program}
                          </Badge>
                        </TableCell>

                        <TableCell className='text-sm text-foreground/80 font-medium'>
                          {course.semesterName}
                          {course.totalSemesters ? ` (${course.totalSemesters} Terms)` : ''}
                        </TableCell>

                        <TableCell>
                          <div className='flex items-center gap-1.5 text-sm text-foreground/90'>
                            <Users className='h-4 w-4 text-muted-foreground' />
                            <span>{course.studentsCount != null ? course.studentsCount : '—'}</span>
                          </div>
                        </TableCell>

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

                        <TableCell>
                          <Badge
                            variant={course.status === 'active' ? 'default' : 'outline'}
                            className='capitalize text-[11px]'
                          >
                            {course.status}
                          </Badge>
                        </TableCell>

                        <TableCell className='text-right pr-6 py-3.5'>
                          <div className='flex items-center justify-end gap-2'>
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
                        <Users className='h-3.5 w-3.5' /> {course.studentsCount != null ? `${course.studentsCount} Students` : '—'}
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

      {selectedCourseForMap && (
        <MapLabDialog
          open={mapLabOpen}
          onOpenChange={setMapLabOpen}
          courseName={selectedCourseForMap.name}
          courseCode={selectedCourseForMap.code}
          programId={programmeIdForCourses}
          semesterId={selectedCourseForMap.semesterId || (selectedSemester !== 'all' ? selectedSemester : '')}
          currentLabsCount={selectedCourseForMap.labsAssigned}
          onLabsUpdated={handleLabsUpdated}
        />
      )}
    </>
  )
}
