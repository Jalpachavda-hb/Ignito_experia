import { z } from 'zod'

export const labStatusSchema = z.union([
  z.literal('active'),
  z.literal('inactive'),
  z.literal('deleted'),
  z.literal('maintenance'),
  z.literal('deprecated'),
])
export type LabStatus = z.infer<typeof labStatusSchema>

export const labCategorySchema = z.union([
  z.literal('Security'),
  z.literal('Networking'),
  z.literal('Development'),
  z.literal('Data Science'),
  z.literal('Cloud Computing'),
])
export type LabCategory = z.infer<typeof labCategorySchema>

export const labSchema = z.object({
  id: z.string().min(1, 'Lab Code is required.'), // This is the LabCode
  title: z.string().min(1, 'Title is required.'),
  subtitle: z.string().min(1, 'Subtitle is required.'),
  program: z.string().optional(),
  semester: z.string().min(1, 'Semester is required.'),
  logoUrl: z.string().min(1, 'Logo URL is required.'),
  category: labCategorySchema.optional(), // Keep category if needed elsewhere, though not specifically in the form
  credits: z.number().min(0, 'Credit cost cannot be negative.'),
  durationMinutes: z.number().min(15, 'Duration must be at least 15 minutes.'),
  complexity: z.string().optional(),
  runtimeType: z.string().min(1, 'Runtime Type is required.'),
  runtimePort: z.coerce
    .number()
    .min(1, 'Port is required.'),
  runtimePath: z.string().min(1, 'Runtime Path is required.'),
  containerApiPath: z.string().optional(),
  taskDefinition: z.string().min(1, 'Task Definition is required.'),
  instructions: z.string().optional(),
  status: labStatusSchema,
  deletedAt: z.coerce.date().optional(),
  deletedBy: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Lab = z.infer<typeof labSchema>
