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
  degree: programDegreeSchema,
  durationYears: z.number().min(1).max(5),
  totalCourses: z.number(),
  totalSemesters: z.number(),
  totalStudents: z.number(),
  totalLabs: z.number(),
  status: z.union([z.literal('active'), z.literal('inactive')]),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Program = z.infer<typeof programSchema>
