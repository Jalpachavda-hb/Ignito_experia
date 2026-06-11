import { createLazyFileRoute } from '@tanstack/react-router'
import LabCatalogue from '@/pages/student/lab-catalogue'

export const Route = createLazyFileRoute('/_authenticated/student/lab-catalogue/')({
  component: LabCatalogue,
})
