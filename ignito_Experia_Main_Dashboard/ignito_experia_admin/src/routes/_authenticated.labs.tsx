import { createFileRoute } from '@tanstack/react-router'
import LabsView from '@/features/labs'

export const Route = createFileRoute('/_authenticated/labs')({
  component: LabsView,
})
