import { createLazyFileRoute } from '@tanstack/react-router'
import TransactionsPreview from '@/pages/student/transactions'

export const Route = createLazyFileRoute('/_authenticated/student/transactions/')({
  component: TransactionsPreview,
})
