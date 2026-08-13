export type PermissionAction = 'create' | 'read' | 'update' | 'delete'

/**
 * Static permission checker. Always returns true for full access.
 */
export function hasPermission(_moduleCode: string, _action?: PermissionAction): boolean {
  return true
}

/**
 * React hook permission checker. Always returns true for full access.
 */
export function usePermission(_moduleCode: string, _action?: PermissionAction): boolean {
  return true
}


