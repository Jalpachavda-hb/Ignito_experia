import { z } from 'zod'

export const auditActionSchema = z.union([
  z.literal('CREATE'),
  z.literal('UPDATE'),
  z.literal('DELETE'),
  z.literal('LOGIN_SUCCESS'),
  z.literal('LOGIN_FAILED'),
  z.literal('EXPORT'),
])
export type AuditAction = z.infer<typeof auditActionSchema>

export const auditModuleSchema = z.union([
  z.literal('Auth'),
  z.literal('Billing'),
  z.literal('Labs'),
  z.literal('Users'),
  z.literal('Roles'),
  z.literal('Programs'),
  z.literal('Courses'),
  z.literal('Semesters'),
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
  category: z.string().optional().default('General'),
  description: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string(),
  payload: z.any().optional(),
})
export type AuditLog = z.infer<typeof auditLogSchema>
