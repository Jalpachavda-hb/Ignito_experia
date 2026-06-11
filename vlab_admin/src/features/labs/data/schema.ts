import { z } from 'zod'

export const labStatusSchema = z.union([
  z.literal('active'),
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
  id: z.string(),
  name: z.string().min(1, 'Lab Name is required.'),
  description: z.string().optional(),
  category: labCategorySchema,
  technologies: z.array(z.string()).min(1, 'At least one technology tag is required.'),
  creditCost: z.number().min(0, 'Credit cost cannot be negative.'),
  durationMinutes: z.number().min(15, 'Duration must be at least 15 minutes.'),
  dockerImage: z.string().min(1, 'Docker image string is required.'),
  environmentConfig: z.string().optional(), // Expected to be JSON or key=value format
  instructions: z.string().optional(),
  status: labStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Lab = z.infer<typeof labSchema>
