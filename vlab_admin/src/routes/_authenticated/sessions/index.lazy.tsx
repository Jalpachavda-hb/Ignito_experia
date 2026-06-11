import { createLazyFileRoute } from '@tanstack/react-router'
import SessionsView from '@/features/sessions'

export const Route = createLazyFileRoute('/_authenticated/sessions/')({
  component: SessionsView,
})
