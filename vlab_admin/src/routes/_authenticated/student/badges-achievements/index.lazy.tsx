import { createLazyFileRoute } from '@tanstack/react-router'
import BadgesAchievementsPage from '@/pages/student/badges-achievements'

export const Route = createLazyFileRoute('/_authenticated/student/badges-achievements/')({
  component: BadgesAchievementsPage,
})
