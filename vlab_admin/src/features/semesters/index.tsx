import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Plus, CalendarDays, CheckCircle2, LayoutTemplate } from 'lucide-react'
import { SemestersTable } from './components/semesters-table'
import { mockSemesters } from './data/mock-data'
import { SemestersProvider, useSemesters } from './context/semesters-context'
import { SemesterActionDialogs } from './components/semesters-action-dialogs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function SemestersViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = useSemesters()

  const handleCreate = () => {
    setCurrentRow(undefined)
    setDialogOpen('create')
  }

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      setDialogOpen(null)
      setTimeout(() => setCurrentRow(undefined), 500)
    }
  }

  const activeCount = mockSemesters.filter(s => s.status === 'active').length
  const completedCount = mockSemesters.filter(s => s.status === 'completed').length
  const totalStudents = mockSemesters.reduce((acc, s) => s.status === 'active' ? acc + s.studentsCount : acc, 0)

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
        <div className='mb-6 flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Semester Management</h1>
            <p className='text-muted-foreground mt-1'>
              Organize students, courses, and labs into time-bound academic terms.
            </p>
          </div>
          <Button onClick={handleCreate} className="shadow-sm">
            <Plus className='mr-2 h-4 w-4' />
            Create Semester
          </Button>
        </div>

        {/* KPI Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Semesters</CardTitle>
              <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockSemesters.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Semesters</CardTitle>
              <CalendarDays className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-900/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-sky-800" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-800 dark:text-sky-400">{totalStudents.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Enrolled in active terms</p>
            </CardContent>
          </Card>
        </div>

        <div className='flex-1 m-0 flex flex-col min-h-0 overflow-hidden'>
          <SemestersTable data={mockSemesters} />
        </div>
      </Main>

      <SemesterActionDialogs 
        open={dialogOpen === 'create'}
        type='create' 
        onOpenChange={(open) => !open && handleDialogChange(false)}
      />

      {currentRow && (
        <SemesterActionDialogs 
          key={`${dialogOpen}-${currentRow.id}`}
          semester={currentRow}
          type={dialogOpen}
          open={dialogOpen === 'edit' || dialogOpen === 'delete'}
          onOpenChange={handleDialogChange}
        />
      )}
    </>
  )
}

export default function SemestersView() {
  return (
    <SemestersProvider>
      <SemestersViewContent />
    </SemestersProvider>
  )
}
