import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SsoCallback } from '@/features/auth/sso-callback'

const searchSchema = z.object({
  token: z.string().optional(),
  accessToken: z.string().optional(),
  access_token: z.string().optional(),
  id_token: z.string().optional(),
  idToken: z.string().optional(),
  studentDegreeAdmissionId: z.union([z.string(), z.number()]).optional(),
  admissionId: z.union([z.string(), z.number()]).optional(),
  student_degree_admission_id: z.union([z.string(), z.number()]).optional(),
  studentId: z.union([z.string(), z.number()]).optional(),
  student_id: z.union([z.string(), z.number()]).optional(),
  studentID: z.union([z.string(), z.number()]).optional(),
  slug: z.string().optional(),
  tenantId: z.string().optional(),
}).passthrough()

export const Route = createFileRoute('/(auth)/sso-callback')({
  component: SsoCallback,
  validateSearch: searchSchema,
})
