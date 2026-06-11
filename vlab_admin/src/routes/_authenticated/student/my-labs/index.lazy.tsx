import { createLazyFileRoute } from '@tanstack/react-router'
import MyLabsPreview from '@/pages/student/my-labs'

export const Route = createLazyFileRoute('/_authenticated/student/my-labs/')({
  component: MyLabsPreview,
})
