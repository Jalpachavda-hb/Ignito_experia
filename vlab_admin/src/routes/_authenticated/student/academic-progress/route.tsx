import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isDirectStudent } from '@/lib/student-kind'

export const Route = createFileRoute('/_authenticated/student/academic-progress')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (isDirectStudent(user)) {
      throw redirect({ to: '/student/dashboard' })
    }
  },
})
