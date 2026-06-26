import { useAuthStore } from '@/stores/auth-store'

export type PermissionAction = 'create' | 'read' | 'update' | 'delete'

/**
 * Static permission checker. Suitable for callbacks, event handlers, and router beforeLoad guards.
 */
export function hasPermission(moduleCode: string, action: PermissionAction): boolean {
  const { auth } = useAuthStore.getState()
  if (auth.user?.role === 'Super Admin') return true
  return auth.user?.permissions?.[moduleCode]?.[action] === true
}

/**
 * React hook permission checker. Triggers re-renders when permission state changes.
 */
export function usePermission(moduleCode: string, action: PermissionAction): boolean {
  const { auth } = useAuthStore()
  if (auth.user?.role === 'Super Admin') return true
  return auth.user?.permissions?.[moduleCode]?.[action] === true
}
