import React, { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Plus, GraduationCap, Users, FlaskConical, Loader2 } from 'lucide-react'
import { ProgramsTable } from './components/programs-table'
import { mockPrograms } from './data/mock-data'
import { ProgramsProvider, usePrograms } from './context/programs-context'
import { ProgramActionDialogs } from './components/programs-action-dialogs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPracticalAvailablePrograms } from '@/Utils/lmsApi_paths'
import { Program } from './data/schema'

function ProgramsViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = usePrograms()
  const [programsList, setProgramsList] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getPracticalAvailablePrograms()
      .then((res: any) => {
        const rawList = res?.programList || res?.rawData?.programList || (Array.isArray(res) ? res : [])
        if (rawList && rawList.length > 0) {
          const mapped: Program[] = rawList.map((p: any) => {
            const name = p.programName || p.programmeNameAndCode || 'Academic Program'
            const code = p.programCode || `PROG-${p.programId}`
            const degree = name.toLowerCase().includes('master') ? 'Masters'
              : name.toLowerCase().includes('bachelor') ? 'Bachelors'
                : name.toLowerCase().includes('doctorate') ? 'Doctorate' : 'Masters'
            const duration = p.programmeDuration ? p.programmeDuration.trim() : `${p.totalSemesters ? Math.ceil(p.totalSemesters / 2) : 2} Years`
            const semesters = p.totalSemesters || 4

            return {
              id: String(p.programId || p.id),
              name: name,
              code: code,
              degree: degree,
              durationYears: p.durationYears || Math.ceil(semesters / 2) || 2,
              durationText: duration,
              totalCourses: p.totalCourses || 12,
              totalSemesters: semesters,
              totalStudents: p.totalStudents || 150,
              totalLabs: p.totalLabs || 8,
              status: p.isActive !== false ? 'active' : 'inactive',
              createdAt: new Date(),
              updatedAt: new Date(),
              rawLmsData: p
            }
          })
          setProgramsList(mapped)
        } else {
          setProgramsList(mockPrograms as any)
        }
      })
      .catch((err: any) => {
        console.error('Failed to load LMS programs:', err)
        setProgramsList(mockPrograms as any)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

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

  const displayPrograms = programsList.length > 0 ? programsList : (mockPrograms as any)
  const totalPrograms = displayPrograms.length
  const totalStudents = displayPrograms.reduce((acc: number, p: any) => acc + (p.totalStudents || 0), 0)
  const totalLabs = displayPrograms.reduce((acc: number, p: any) => acc + (p.totalLabs || 0), 0)

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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span className="text-sm text-muted-foreground font-medium">Loading LMS programs...</span>
            </div>
          ) : (
            <ProgramsTable data={displayPrograms} />
          )}
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
