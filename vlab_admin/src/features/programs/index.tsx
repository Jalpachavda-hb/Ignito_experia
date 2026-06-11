import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Plus, GraduationCap, Users, FlaskConical } from 'lucide-react'
import { ProgramsTable } from './components/programs-table'
import { mockPrograms } from './data/mock-data'
import { ProgramsProvider, usePrograms } from './context/programs-context'
import { ProgramActionDialogs } from './components/programs-action-dialogs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function ProgramsViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = usePrograms()

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

  const totalPrograms = mockPrograms.length
  const totalStudents = mockPrograms.reduce((acc, p) => acc + p.totalStudents, 0)
  const totalLabs = mockPrograms.reduce((acc, p) => acc + p.totalLabs, 0)

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
            <h1 className='text-3xl font-bold tracking-tight'>Program Management</h1>
            <p className='text-muted-foreground mt-1'>
              Manage top-level academic degrees and their hierarchical structures.
            </p>
          </div>
          <Button onClick={handleCreate} className="shadow-sm">
            <Plus className='mr-2 h-4 w-4' />
            Create Program
          </Button>
        </div>

        {/* KPI Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
              <GraduationCap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalPrograms}</div>
              <p className="text-xs text-muted-foreground mt-1">Active degrees offered</p>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Global Enrollment</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalStudents.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Students across all programs</p>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Linked Labs</CardTitle>
              <FlaskConical className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalLabs.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Virtual environments utilized</p>
            </CardContent>
          </Card>
        </div>

        <div className='flex-1 m-0 flex flex-col min-h-0 overflow-hidden'>
          <ProgramsTable data={mockPrograms} />
        </div>
      </Main>

      <ProgramActionDialogs 
        open={dialogOpen === 'create'}
        type='create'
        onOpenChange={(open) => !open && handleDialogChange(false)}
      />

      {currentRow && (
        <ProgramActionDialogs 
          key={`${dialogOpen}-${currentRow.id}`}
          program={currentRow}
          type={dialogOpen}
          open={dialogOpen === 'edit' || dialogOpen === 'delete'}
          onOpenChange={handleDialogChange}
        />
      )}
    </>
  )
}

export default function ProgramsView() {
  return (
    <ProgramsProvider>
      <ProgramsViewContent />
    </ProgramsProvider>
  )
}
