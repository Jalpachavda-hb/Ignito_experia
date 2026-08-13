import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List } from 'lucide-react'
import { LabsTable } from './components/labs-table'
import { LabsKanban } from './components/labs-kanban'
import { LabsProvider, useLabs } from './context/labs-context'
import { LabDetailsDrawer } from './components/lab-details-drawer'
import { useLabsQuery } from './data/api'

function LabsViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = useLabs()
  const { data: labsData = [], isLoading, isError } = useLabsQuery('all')

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      setDialogOpen(null)
      setTimeout(() => setCurrentRow(undefined), 500)
    }
  }

  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')

  useMemo(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('labsViewMode') as 'board' | 'table' : null
    if (saved) setViewMode(saved)
  }, [])

  const handleViewModeChange = (mode: 'board' | 'table') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') localStorage.setItem('labsViewMode', mode)
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

      <Main>
        <div className='mb-6 flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Lab Catalog</h1>
            <p className='text-muted-foreground mt-1'>
              Browse available virtual lab environments, workspace containers, and technology configurations.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">Loading labs...</p>
          </div>
        ) : isError ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <p className="text-red-500 bg-red-50 px-4 py-2 rounded-md">Failed to load labs. Please try again later.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-end mb-4">
              <div className="flex items-center space-x-2 bg-muted p-1 rounded-md">
                <Button 
                  variant={viewMode === 'board' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => handleViewModeChange('board')}
                  className="h-7 px-3 text-xs shadow-none"
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Board View
                </Button>
                <Button 
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => handleViewModeChange('table')}
                  className="h-7 px-3 text-xs shadow-none"
                >
                  <List className="h-4 w-4 mr-2" />
                  Table View
                </Button>
              </div>
            </div>

            {viewMode === 'board' ? (
              <LabsKanban data={labsData} />
            ) : (
              <LabsTable data={labsData} />
            )}
          </div>
        )}
      </Main>

      {currentRow && (
        <LabDetailsDrawer
          key={`view-${currentRow.id}`}
          lab={currentRow}
          open={dialogOpen === 'view'}
          onOpenChange={handleDialogChange}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )}
    </>
  )
}

export default function LabsView() {
  return (
    <LabsProvider>
      <LabsViewContent />
    </LabsProvider>
  )
}
