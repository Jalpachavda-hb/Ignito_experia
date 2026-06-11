import { z } from 'zod'

export const semesterStatusSchema = z.union([
  z.literal('upcoming'),
  z.literal('active'),
  z.literal('completed'),
])
export type SemesterStatus = z.infer<typeof semesterStatusSchema>

export const semesterSchema = z.object({
  id: z.string(),
  name: z.string(),
  courseId: z.string(),
  courseName: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  studentsCount: z.number(),
  labsAssigned: z.number(),
  allocatedCredits: z.number(),
  status: semesterStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Semester = z.infer<typeof semesterSchema>
