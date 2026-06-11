import { createLazyFileRoute } from '@tanstack/react-router'
import StudentDashboardPreview from '@/pages/student/dashboard'

export const Route = createLazyFileRoute('/_authenticated/student/dashboard/')({
  component: StudentDashboardPreview,
})
