import { createFileRoute } from '@tanstack/react-router'
import CourseDetailsView from '@/features/courses/details'

export const Route = createFileRoute('/_authenticated/courses/$courseId')({
  component: CourseDetailsView,
})
