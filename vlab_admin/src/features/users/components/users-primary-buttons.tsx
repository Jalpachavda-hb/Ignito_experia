import { MailPlus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUsers } from './users-provider'
import { useAuthStore } from '@/stores/auth-store'

export function UsersPrimaryButtons() {
  const { setOpen } = useUsers()
  const { auth } = useAuthStore()
  const roleCode = auth?.user?.roleCode || ''
  
  // Example RBAC check: only admins can manage users
  const canManageUsers = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(roleCode)

  if (!canManageUsers) return null;
  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={() => setOpen('invite')}
      >
        <span>Invite User</span> <MailPlus size={18} />
      </Button>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add User</span> <UserPlus size={18} />
      </Button>
      <Button className='space-x-1' onClick={() => setOpen('import')}>
        <span>Bulk Import</span> <UserPlus size={18} />
      </Button>
    </div>
  )
}
