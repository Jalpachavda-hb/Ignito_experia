import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { CoursesTable } from './components/courses-table'
import { CoursesKanban } from './components/courses-kanban'
import { mockCourses } from './data/mock-data'
import { CoursesProvider, useCourses } from './context/courses-context'
import { CourseActionDialogs } from './components/courses-action-dialogs'

function CoursesViewContent() {
  const { dialogOpen, setDialogOpen, currentRow, setCurrentRow } = useCourses()

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
            <h1 className='text-3xl font-bold tracking-tight'>Course Management</h1>
            <p className='text-muted-foreground mt-1'>
              Design curriculums, organize semesters, and link virtual labs to academic programs.
            </p>
          </div>
          <Button onClick={handleCreate} className="shadow-sm">
            <Plus className='mr-2 h-4 w-4' />
            Create Course
          </Button>
        </div>

        <Tabs defaultValue="table" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="table" className="gap-2">
                <List className="h-4 w-4" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Board View
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="table" className="flex-1 m-0 border-none outline-none data-[state=active]:flex flex-col min-h-0 overflow-hidden">
            <CoursesTable data={mockCourses} />
          </TabsContent>
          
          <TabsContent value="kanban" className="flex-1 m-0 border-none outline-none data-[state=active]:flex flex-col min-h-0 overflow-hidden">
            <CoursesKanban data={mockCourses} />
          </TabsContent>
        </Tabs>
      </Main>

      <CourseActionDialogs 
        open={dialogOpen === 'create'}
        type='create'
        onOpenChange={(open) => !open && handleDialogChange(false)}
      />

      {currentRow && (
        <CourseActionDialogs 
          key={`${dialogOpen}-${currentRow.id}`}
          course={currentRow}
          type={dialogOpen}
          open={dialogOpen === 'edit' || dialogOpen === 'delete' || dialogOpen === 'assign-labs'}
          onOpenChange={handleDialogChange}
        />
      )}
    </>
  )
}

export default function CoursesView() {
  return (
    <CoursesProvider>
      <CoursesViewContent />
    </CoursesProvider>
  )
}
