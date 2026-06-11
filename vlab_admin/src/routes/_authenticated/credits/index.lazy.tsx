import { createLazyFileRoute } from '@tanstack/react-router'
import CreditsView from '@/features/credits'

export const Route = createLazyFileRoute('/_authenticated/credits/')({
  component: CreditsView,
})
