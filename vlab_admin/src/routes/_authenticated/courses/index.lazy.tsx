import { createLazyFileRoute } from '@tanstack/react-router'
import CoursesView from '@/features/courses'

export const Route = createLazyFileRoute('/_authenticated/courses/')({
  component: CoursesView,
})
