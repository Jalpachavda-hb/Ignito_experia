import { z } from 'zod'

export const sessionStatusSchema = z.union([
  z.literal('running'),
  z.literal('stopped'),
  z.literal('failed'),
])
export type SessionStatus = z.infer<typeof sessionStatusSchema>

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  labName: z.string(),
  course: z.string(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().nullable(),
  status: sessionStatusSchema,
  cpuUsage: z.number().min(0).max(100), // percentage
  ramUsage: z.number().min(0).max(100), // percentage
})
export type Session = z.infer<typeof sessionSchema>
