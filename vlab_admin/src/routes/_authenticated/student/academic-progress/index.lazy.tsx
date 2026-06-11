import { createLazyFileRoute } from '@tanstack/react-router'
import AcademicProgressPreview from '@/pages/student/academic-progress'

export const Route = createLazyFileRoute('/_authenticated/student/academic-progress/')({
  component: AcademicProgressPreview,
})
