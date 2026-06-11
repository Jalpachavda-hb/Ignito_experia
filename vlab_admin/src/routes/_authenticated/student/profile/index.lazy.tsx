import { createLazyFileRoute } from '@tanstack/react-router'
import ProfilePreview from '@/pages/student/profile'

export const Route = createLazyFileRoute('/_authenticated/student/profile/')({
  component: ProfilePreview,
})
