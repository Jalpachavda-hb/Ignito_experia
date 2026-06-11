import { createLazyFileRoute } from '@tanstack/react-router'
import ReportsView from '@/features/reports'

export const Route = createLazyFileRoute('/_authenticated/reports/')({
  component: ReportsView,
})
