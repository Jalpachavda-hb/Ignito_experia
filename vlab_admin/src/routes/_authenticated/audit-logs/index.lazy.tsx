import { createLazyFileRoute } from '@tanstack/react-router'
import AuditLogsView from '@/features/audit-logs'

export const Route = createLazyFileRoute('/_authenticated/audit-logs/')({
  component: AuditLogsView,
})
