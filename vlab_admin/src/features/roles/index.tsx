import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { roles } from './data/roles'
import { type Role } from './data/schema'
import { RoleCard } from './components/role-card'
import { RoleActionDialog } from './components/role-action-dialog'
import { RoleDeleteDialog } from './components/role-delete-dialog'

export default function RolesView() {
  const [openDialog, setOpenDialog] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [currentRow, setCurrentRow] = useState<Role | undefined>(undefined)

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
              Define roles and configure their granular permissions across {roles.length} existing roles.
            </p>
          </div>
          <Button onClick={handleCreate} className="shadow-md">
            <Plus className='mr-2 h-4 w-4' />
            Create Role
          </Button>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {roles.map((role) => (
            <RoleCard 
              key={role.id} 
              role={role} 
              onEdit={handleEdit} 
              onDelete={handleDelete} 
            />
          ))}
        </div>
      </Main>

      <RoleActionDialog 
        open={openDialog === 'create'}
        onOpenChange={(open) => !open && handleDialogChange(false)}
      />

      {currentRow && (
        <>
          <RoleActionDialog 
            key={`edit-${currentRow.id}`}
            currentRow={currentRow}
            open={openDialog === 'edit'}
            onOpenChange={handleDialogChange}
          />
          <RoleDeleteDialog 
            key={`delete-${currentRow.id}`}
            currentRow={currentRow}
            open={openDialog === 'delete'}
            onOpenChange={handleDialogChange}
          />
        </>
      )}
    </>
  )
}
