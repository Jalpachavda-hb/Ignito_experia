import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { LabsTable } from './components/labs-table'
import { LabsKanban } from './components/labs-kanban'
import { mockLabs } from './data/mock-data'
import { LabsProvider, useLabs } from './context/labs-context'
import { LabActionDialog } from './components/lab-action-dialog'
import { LabDeleteDialog } from './components/lab-delete-dialog'

function LabsViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = useLabs()

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
            <h1 className='text-3xl font-bold tracking-tight'>Lab Management</h1>
            <p className='text-muted-foreground mt-1'>
              Manage virtual lab environments, docker images, and technology configurations.
            </p>
          </div>
          <Button onClick={handleCreate} className="shadow-sm">
            <Plus className='mr-2 h-4 w-4' />
            Create Lab
          </Button>
        </div>

        <Tabs defaultValue="kanban" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Board View
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2">
                <List className="h-4 w-4" />
                Table View
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="kanban" className="flex-1 m-0 border-none outline-none data-[state=active]:flex flex-col min-h-0 overflow-hidden">
            <LabsKanban data={mockLabs} />
          </TabsContent>
          
          <TabsContent value="table" className="flex-1 m-0 border-none outline-none data-[state=active]:flex flex-col min-h-0 overflow-hidden">
            <LabsTable data={mockLabs} />
          </TabsContent>
        </Tabs>
      </Main>

      <LabActionDialog 
        open={dialogOpen === 'create'}
        mode='create'
        onOpenChange={(open) => !open && handleDialogChange(false)}
      />

      {currentRow && (
        <>
          <LabActionDialog 
            key={`edit-${currentRow.id}`}
            currentRow={currentRow}
            mode='edit'
            open={dialogOpen === 'edit' || dialogOpen === 'view'}
            onOpenChange={handleDialogChange}
          />
          <LabActionDialog 
            key={`clone-${currentRow.id}`}
            currentRow={currentRow}
            mode='clone'
            open={dialogOpen === 'clone'}
            onOpenChange={handleDialogChange}
          />
          <LabDeleteDialog 
            key={`delete-${currentRow.id}`}
            currentRow={currentRow}
            open={dialogOpen === 'delete'}
            onOpenChange={handleDialogChange}
          />
        </>
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
