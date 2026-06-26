import { z } from 'zod'

export const MODULES = [
  'DASHBOARD',
  'ROLE_MANAGEMENT',
  'USER_MANAGEMENT',
  'LAB_MANAGEMENT',
  'PROGRAM_MANAGEMENT',
  'COURSE_MANAGEMENT',
  'SEMESTER_MANAGEMENT',
  'CREDIT_MANAGEMENT',
  'TRANSACTION_MANAGEMENT',
  'REPORTS',
  'SETTINGS',
  'SESSION_MONITORING',
  'STUDENT_MANAGEMENT',
  'FACULTY_MANAGEMENT',
] as const

export const MODULE_LABELS: Record<typeof MODULES[number], string> = {
  DASHBOARD: 'Dashboard',
  ROLE_MANAGEMENT: 'Role Management',
  USER_MANAGEMENT: 'User Management',
  LAB_MANAGEMENT: 'Lab Management',
  PROGRAM_MANAGEMENT: 'Program Management',
  COURSE_MANAGEMENT: 'Course Management',
  SEMESTER_MANAGEMENT: 'Semester Management',
  CREDIT_MANAGEMENT: 'Credit Management',
  TRANSACTION_MANAGEMENT: 'Transaction Management',
  REPORTS: 'Reports',
  SETTINGS: 'Settings',
  SESSION_MONITORING: 'Session Monitoring',
  STUDENT_MANAGEMENT: 'Student Management',
  FACULTY_MANAGEMENT: 'Faculty Management',
}

export type ModuleName = typeof MODULES[number]

export const permissionSchema = z.object({
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
})
export type Permission = z.infer<typeof permissionSchema>

export const roleSchema = z.object({
  roleId: z.number(),
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional().nullable(),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  userCount: z.number().default(0),
  permissions: z.record(z.string(), permissionSchema),
  createdDate: z.coerce.date().optional().nullable(),
  updatedDate: z.coerce.date().optional().nullable(),
})
export type Role = z.infer<typeof roleSchema>

// Form schema for create/edit dialog
export const roleFormSchema = z.object({
  name: z.string().min(1, 'Role name is required.'),
  description: z.string().optional(),
  permissions: z.record(z.string(), permissionSchema),
  isEdit: z.boolean(),
})
export type RoleForm = z.infer<typeof roleFormSchema>
