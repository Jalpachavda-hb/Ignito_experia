import { createLazyFileRoute } from '@tanstack/react-router'
import SemestersView from '@/features/semesters'

export const Route = createLazyFileRoute('/_authenticated/semesters/')({
  component: SemestersView,
})
