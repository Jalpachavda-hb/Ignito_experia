import { z } from 'zod'

const _userSchema = z.object({
  UserId: z.number(),
  FullName: z.string(),
  Email: z.string(),
  PhoneNumber: z.string().nullable().optional(),
  Role: z.string(),
  EnrollmentNumber: z.string().nullable().optional(),
  ProgramId: z.number().nullable().optional(),
  SemesterId: z.number().nullable().optional(),
  CreditBalance: z.union([z.string(), z.number()]).default(0),
  LastLoginAt: z.string().nullable().optional(),
  CreatedAt: z.string(),
})
export type User = z.infer<typeof _userSchema>
