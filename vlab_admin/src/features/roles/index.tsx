import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, AlertCircle } from 'lucide-react'
import { type Role } from './data/schema'
import { RoleCard } from './components/role-card'
import { RoleActionDialog } from './components/role-action-dialog'
import { RoleDeleteDialog } from './components/role-delete-dialog'
import { getRoles } from '@/services/rolesService'

export default function RolesView() {
  const [openDialog, setOpenDialog] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [currentRow, setCurrentRow] = useState<Role | undefined>(undefined)
  const queryClient = useQueryClient()

  const { data: roles = [], isLoading, isError, error } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  })

  const handleEdit = (role: Role) => {
    setCurrentRow(role)
    setOpenDialog('edit')
  }

  const handleDelete = (role: Role) => {
    setCurrentRow(role)
    setOpenDialog('delete')
  }

  const handleCreate = () => {
    setCurrentRow(undefined)
    setOpenDialog('create')
  }

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      setOpenDialog(null)
      setTimeout(() => setCurrentRow(undefined), 500)
    }
  }

  const handleMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['roles'] })
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
        <div className='mb-8 flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Role Management</h1>
            <p className='text-muted-foreground mt-1'>
              Define roles and configure their granular permissions across {isLoading ? '...' : roles.length} existing roles.
            </p>
          </div>
          <Button onClick={handleCreate} className="shadow-md">
            <Plus className='mr-2 h-4 w-4' />
            Create Role
          </Button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-9 flex-1 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
            <AlertCircle className="h-10 w-10" />
            <p className="font-medium text-lg">Failed to load roles</p>
            <p className="text-sm text-muted-foreground">
              {(error as any)?.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['roles'] })}>
              Retry
            </Button>
          </div>
        )}

        {/* Roles grid */}
        {!isLoading && !isError && (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {roles.map((role: Role) => (
              <RoleCard 
                key={role.roleId} 
                role={role} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
              />
            ))}
            {roles.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <p className="text-lg font-medium">No roles found</p>
                <p className="text-sm">Create your first role to get started.</p>
              </div>
            )}
          </div>
        )}
      </Main>

      <RoleActionDialog 
        open={openDialog === 'create'}
        onOpenChange={(open) => !open && handleDialogChange(false)}
        onSuccess={handleMutationSuccess}
      />

      {currentRow && (
        <>
          <RoleActionDialog 
            key={`edit-${currentRow.roleId}`}
            currentRow={currentRow}
            open={openDialog === 'edit'}
            onOpenChange={handleDialogChange}
            onSuccess={handleMutationSuccess}
          />
          <RoleDeleteDialog 
            key={`delete-${currentRow.roleId}`}
            currentRow={currentRow}
            open={openDialog === 'delete'}
            onOpenChange={handleDialogChange}
            onSuccess={handleMutationSuccess}
          />
        </>
      )}
    </>
  )
}
