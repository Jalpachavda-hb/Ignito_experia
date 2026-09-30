import React, { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Plus, GraduationCap, Users, FlaskConical, Loader2 } from 'lucide-react'
import { ProgramsTable } from './components/programs-table'
import { ProgramsProvider, usePrograms } from './context/programs-context'
import { ProgramActionDialogs } from './components/programs-action-dialogs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPracticalAvailablePrograms } from '@/Utils/lmsApi_paths'
import { Program } from './data/schema'
import { extractProgramList, mapLmsProgram } from './data/map-lms-program'

function ProgramsViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = usePrograms()
  const [programsList, setProgramsList] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPracticalAvailablePrograms()
      .then((res: any) => {
        if (cancelled) return
        const mapped = extractProgramList(res)
          .map(mapLmsProgram)
          .filter((p) => p.id)
        setProgramsList(mapped)
      })
      .catch((err: any) => {
        console.error('Failed to load LMS programs:', err)
        if (cancelled) return
        setProgramsList([])
        setError(err?.message || 'Failed to load programs from LMS')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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

  const totalPrograms = programsList.length
  const totalStudents = programsList.reduce((acc, p) => acc + (p.totalStudents || 0), 0)
  const totalLabs = programsList.reduce((acc, p) => acc + (p.totalLabs || 0), 0)

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

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full -mr-4 -mt-4"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
              <GraduationCap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{loading ? '—' : totalPrograms}</div>
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
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {loading ? '—' : totalStudents.toLocaleString()}
              </div>
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
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {loading ? '—' : totalLabs.toLocaleString()}
              </div>
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
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-sm">Could not load programs</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          ) : (
            <ProgramsTable data={programsList} />
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
