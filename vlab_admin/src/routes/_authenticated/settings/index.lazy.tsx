import { createLazyFileRoute } from '@tanstack/react-router'
import SettingsView from '@/features/settings'

export const Route = createLazyFileRoute('/_authenticated/settings/')({
  component: SettingsView,
})
