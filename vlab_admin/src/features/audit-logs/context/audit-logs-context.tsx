import React, { createContext, useContext, useState } from 'react'
import { type AuditLog } from '../data/schema'

interface AuditLogsContextType {
  sheetOpen: boolean
  setSheetOpen: (open: boolean) => void
  currentRow: AuditLog | undefined
  setCurrentRow: (row: AuditLog | undefined) => void
}

const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined)

export function AuditLogsProvider({ children }: { children: React.ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [currentRow, setCurrentRow] = useState<AuditLog | undefined>(undefined)

  return (
    <AuditLogsContext.Provider value={{ sheetOpen, setSheetOpen, currentRow, setCurrentRow }}>
      {children}
    </AuditLogsContext.Provider>
  )
}

export function useAuditLogs() {
  const context = useContext(AuditLogsContext)
  if (!context) {
    throw new Error('useAuditLogs must be used within a AuditLogsProvider')
  }
  return context
}
