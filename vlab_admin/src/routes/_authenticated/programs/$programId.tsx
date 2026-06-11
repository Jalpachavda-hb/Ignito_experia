import { createFileRoute } from '@tanstack/react-router'
import ProgramDetailsView from '@/features/programs/details'

export const Route = createFileRoute('/_authenticated/programs/$programId')({
  component: ProgramDetailsView,
})
