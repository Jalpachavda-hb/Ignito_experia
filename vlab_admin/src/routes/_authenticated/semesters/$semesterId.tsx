import { createFileRoute } from '@tanstack/react-router'
import SemesterDetailsView from '@/features/semesters/details'

export const Route = createFileRoute('/_authenticated/semesters/$semesterId')({
  component: SemesterDetailsView,
})
