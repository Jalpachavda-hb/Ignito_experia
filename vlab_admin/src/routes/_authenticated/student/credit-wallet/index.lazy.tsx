import { createLazyFileRoute } from '@tanstack/react-router'
import CreditWalletPreview from '@/pages/student/credit-wallet'

export const Route = createLazyFileRoute('/_authenticated/student/credit-wallet/')({
  component: CreditWalletPreview,
})
