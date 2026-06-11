import { createLazyFileRoute } from '@tanstack/react-router'
import TransactionsView from '@/features/transactions'

export const Route = createLazyFileRoute('/_authenticated/transactions/')({
  component: TransactionsView,
})
