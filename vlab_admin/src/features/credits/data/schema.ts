import { z } from 'zod'

export const transactionTypeSchema = z.union([
  z.literal('allocation'),
  z.literal('consumption'),
])
export type TransactionType = z.infer<typeof transactionTypeSchema>

export const transactionSchema = z.object({
  id: z.string(),
  date: z.coerce.date(),
  userId: z.string(),
  userName: z.string(),
  amount: z.number(),
  type: transactionTypeSchema,
  admin: z.string().optional(),
  reason: z.string(),
})
export type Transaction = z.infer<typeof transactionSchema>

export const walletSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  role: z.string(),
  course: z.string().optional(),
  semester: z.string().optional(),
  balance: z.number(),
  usedCredits: z.number(),
  lastUpdated: z.coerce.date(),
})
export type Wallet = z.infer<typeof walletSchema>
