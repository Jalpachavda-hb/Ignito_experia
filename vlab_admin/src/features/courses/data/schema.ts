import { z } from 'zod'

export const courseProgramSchema = z.union([
  z.literal('Computer Science'),
  z.literal('Cyber Security'),
  z.literal('Data Science'),
  z.literal('Cloud Computing'),
  z.literal('Software Engineering'),
  z.literal('MCA'),
  z.literal('BCA'),
])
export type CourseProgram = z.infer<typeof courseProgramSchema>

export const courseStatusSchema = z.union([
  z.literal('active'),
  z.literal('draft'),
  z.literal('archived'),
])
export type CourseStatus = z.infer<typeof courseStatusSchema>

export const courseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  program: courseProgramSchema,
  totalSemesters: z.number().min(1).max(8),
  studentsCount: z.number(),
  labsAssigned: z.number(),
  status: courseStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  description: z.string().optional(),
})
export type Course = z.infer<typeof courseSchema>
