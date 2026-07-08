import { type ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { OwnerSidebar } from './owner-sidebar'

interface OwnerLayoutProps {
  children: ReactNode
}

export function OwnerLayout({ children }: OwnerLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <OwnerSidebar />
      <SidebarInset className="@container/content flex flex-col min-h-0 overflow-y-auto">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
