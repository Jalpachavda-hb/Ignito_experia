import { z } from 'zod'

export const programDegreeSchema = z.union([
  z.literal('Bachelors'),
  z.literal('Masters'),
  z.literal('Doctorate'),
  z.literal('Diploma'),
])
export type ProgramDegree = z.infer<typeof programDegreeSchema>

export const programSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  degree: z.string(),
  durationYears: z.number().optional(),
  durationText: z.string().optional(),
  totalCourses: z.number().optional(),
  totalSemesters: z.number().optional(),
  totalStudents: z.number().optional(),
  totalLabs: z.number().optional(),
  status: z.union([z.literal('active'), z.literal('inactive'), z.string()]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  rawLmsData: z.any().optional(),
})
export type Program = z.infer<typeof programSchema>
