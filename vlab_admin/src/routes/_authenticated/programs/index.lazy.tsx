import { createLazyFileRoute } from '@tanstack/react-router'
import ProgramsView from '@/features/programs'

export const Route = createLazyFileRoute('/_authenticated/programs/')({
  component: ProgramsView,
})
