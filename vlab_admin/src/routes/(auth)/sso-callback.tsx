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
  studentId: z.union([z.string(), z.number()]).optional(),
})

export const Route = createFileRoute('/(auth)/sso-callback')({
  component: SsoCallback,
  validateSearch: searchSchema,
})
