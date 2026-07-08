import { z } from 'zod'

export const labStatusSchema = z.union([
  z.literal('active'),
  z.literal('inactive'),
  z.literal('deleted'),
  z.literal('maintenance'),
])
export type LabStatus = z.infer<typeof labStatusSchema>

export const labSchema = z.object({
  id: z.string().min(1, 'Lab Code is required.'),
  title: z.string().min(1, 'Title is required.'),
  subtitle: z.string().optional().default(''),
  semester: z.string().optional().default(''),
  logoUrl: z.string().optional().default(''),
  category: z.string().optional().default(''),
  credits: z.number().min(0).default(0),
  durationMinutes: z.number().min(15).default(60),
  complexity: z.string().optional().default(''),
  runtimeType: z.string().min(1, 'Runtime Type is required.'),
  runtimePort: z.number().nullable().optional(),
  runtimePath: z.string().optional().default(''),
  containerApiEnabled: z.boolean().optional().default(false),
  containerApiPort: z.number().nullable().optional(),
  taskDefinition: z.string().optional().default(''),
  description: z.string().optional().default(''),
  status: labStatusSchema.default('active'),
  displayOrder: z.number().optional().default(0),
  dbId: z.number().optional(),
  isDeleted: z.boolean().optional().default(false),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
})

export type Lab = z.infer<typeof labSchema>
