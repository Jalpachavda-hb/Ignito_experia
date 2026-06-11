import { z } from 'zod'

export const auditActionSchema = z.enum([
  'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'EXPORT'
])
export type AuditAction = z.infer<typeof auditActionSchema>

export const auditModuleSchema = z.enum([
  'Auth', 'Billing', 'Labs', 'Users', 'Roles', 'Programs', 'Courses', 'Semesters'
])
export type AuditModule = z.infer<typeof auditModuleSchema>

export const auditLogSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  action: auditActionSchema,
  module: auditModuleSchema,
  description: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  payload: z.any().optional(),
})
export type AuditLog = z.infer<typeof auditLogSchema>
