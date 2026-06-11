import { createLazyFileRoute } from '@tanstack/react-router'
import RolesView from '@/features/roles'

export const Route = createLazyFileRoute('/_authenticated/roles/')({
  component: RolesView,
})
