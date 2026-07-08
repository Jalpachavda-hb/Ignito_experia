import { useState, useMemo } from 'react'
import { Plus, LayoutGrid, List, Loader2, FlaskConical } from 'lucide-react'
import { LabsTable } from './components/labs-table'
import { LabsKanban } from './components/labs-kanban'
import { LabsProvider, useLabs } from './context/labs-context'
import { LabActionDialog } from './components/lab-action-dialog'
import { LabDeleteDialog } from './components/lab-delete-dialog'
import { LabDetailsDrawer } from './components/lab-details-drawer'
import { useLabsQuery } from './data/api'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

function LabsViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = useLabs()
  const [activeTab, setActiveTab] = useState<string>('active')
  const { data: labsData = [], isLoading, isError } = useLabsQuery(activeTab === 'all' ? undefined : activeTab)

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

  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')

  useMemo(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ownerLabsViewMode') : null
    if (saved === 'board' || saved === 'table') setViewMode(saved)
  }, [])

  const handleViewModeChange = (mode: 'board' | 'table') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') localStorage.setItem('ownerLabsViewMode', mode)
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Lab Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Global virtual lab catalog. Create, edit, and configure virtual environments for all SaaS customers.
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-98 transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              Create New Lab
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-2">
            <div className="flex gap-2">
              {[
                { value: 'active', label: 'Active Labs' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'all', label: 'All Catalog' }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'px-4 py-2 text-xs font-semibold rounded-lg transition-all',
                    activeTab === tab.value
                      ? 'bg-secondary text-primary shadow-sm border border-border/50'
                      : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                  )}
                >
                  {tab.label}
                  {activeTab === tab.value && ` (${labsData.length})`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-secondary/80 border border-border p-1 rounded-xl">
              <button
                onClick={() => handleViewModeChange('board')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  viewMode === 'board'
                    ? 'bg-background text-foreground shadow-sm border border-border/20'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </button>
              <button
                onClick={() => handleViewModeChange('table')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  viewMode === 'table'
                    ? 'bg-background text-foreground shadow-sm border border-border/20'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-2.5">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading catalog labs...</p>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="glass rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-4 text-center max-w-sm">
                <p className="text-sm text-destructive font-semibold">Failed to load lab catalog.</p>
                <p className="text-xs text-muted-foreground mt-1">Please check your backend connection or refresh.</p>
              </div>
            </div>
          ) : labsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
              <div className="h-14 w-14 rounded-2xl bg-secondary border border-border flex items-center justify-center">
                <FlaskConical className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No labs found in this category.</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              {viewMode === 'board' ? (
                <LabsKanban data={labsData} />
              ) : (
                <LabsTable data={labsData} />
              )}
            </div>
          )}

          <LabActionDialog
            open={dialogOpen === 'create'}
            mode='create'
            onOpenChange={handleDialogChange}
          />

          {currentRow && (
            <>
              <LabActionDialog
                key={`edit-${currentRow.id}`}
                currentRow={currentRow}
                mode='edit'
                open={dialogOpen === 'edit'}
                onOpenChange={handleDialogChange}
              />
              <LabDetailsDrawer
                key={`view-${currentRow.id}`}
                lab={currentRow}
                open={dialogOpen === 'view'}
                onOpenChange={handleDialogChange}
                onEdit={() => setDialogOpen('edit')}
                onDelete={() => setDialogOpen('delete')}
              />
              <LabDeleteDialog
                key={`delete-${currentRow.id}`}
                currentRow={currentRow}
                open={dialogOpen === 'delete'}
                onOpenChange={handleDialogChange}
              />
            </>
          )}
        </div>
      </Main>
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
