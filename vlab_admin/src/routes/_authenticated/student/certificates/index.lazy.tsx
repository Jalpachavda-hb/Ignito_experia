import { createLazyFileRoute } from '@tanstack/react-router'
import CertificatesPreview from '@/pages/student/certificates'

export const Route = createLazyFileRoute('/_authenticated/student/certificates/')({
  component: CertificatesPreview,
})
