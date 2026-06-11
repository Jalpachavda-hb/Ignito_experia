import { createLazyFileRoute } from '@tanstack/react-router'
import LabsView from '@/features/labs'

export const Route = createLazyFileRoute('/_authenticated/labs/')({
  component: LabsView,
})
