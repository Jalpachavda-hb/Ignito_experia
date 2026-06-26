import { z } from 'zod'

export const auditLogSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  action: z.string(),
  module: z.string(),
  category: z.string(),
  description: z.string(),
  userAgent: z.string(),
  payload: z.any().optional(),
})
export type AuditLog = z.infer<typeof auditLogSchema>
