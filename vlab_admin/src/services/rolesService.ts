import { apiRequest } from '@/lib/apiClient'
import type { RoleForm } from '@/features/roles/data/schema'

export const getRoles = async () => {
  const data = await apiRequest('/roles')
  return data.roles ?? []
}

export const getRoleById = async (roleId: number) => {
  const data = await apiRequest(`/roles/${roleId}`)
  return data.role
}

export const createRole = async (payload: Omit<RoleForm, 'isEdit'>) => {
  const permissions: Record<string, { CanCreate: number; CanRead: number; CanUpdate: number; CanDelete: number }> = {}
  Object.entries(payload.permissions || {}).forEach(([moduleCode, actions]) => {
    permissions[moduleCode] = {
      CanCreate: actions.create ? 1 : 0,
      CanRead: actions.read ? 1 : 0,
      CanUpdate: actions.update ? 1 : 0,
      CanDelete: actions.delete ? 1 : 0,
    }
  })

  return apiRequest('/roles', {
    method: 'POST',
    body: JSON.stringify({
      Name: payload.name,
      Description: payload.description || null,
      Permissions: payload.permissions,
    }),
  })
}

export const updateRole = async (roleId: number, payload: Omit<RoleForm, 'isEdit'>) => {
  return apiRequest(`/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      Name: payload.name,
      Description: payload.description || null,
      Permissions: payload.permissions,
    }),
  })
}

export const deleteRole = async (roleId: number) => {
  return apiRequest(`/roles/${roleId}`, { method: 'DELETE' })
}
