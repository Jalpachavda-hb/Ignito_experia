import { z } from 'zod'

export const MODULES = [
  'User Management',
  'Course Management',
  'Semester Management',
  'Lab Management',
  'Credit Management',
  'Reports',
  'Session Monitoring',
  'Settings',
] as const

export type ModuleName = typeof MODULES[number]

export const permissionSchema = z.object({
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
})
export type Permission = z.infer<typeof permissionSchema>

export const roleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
  userCount: z.number().default(0),
  permissions: z.record(z.enum(MODULES), permissionSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type Role = z.infer<typeof roleSchema>
