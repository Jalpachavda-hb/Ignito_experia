import React, { createContext, useContext, useState } from 'react'
import { type Session } from '../data/schema'

type DialogType = 'logs' | 'extend' | 'terminate' | null

interface SessionsContextType {
  dialogOpen: DialogType
  setDialogOpen: (open: DialogType) => void
  currentRow: Session | undefined
  setCurrentRow: (row: Session | undefined) => void
}

const SessionsContext = createContext<SessionsContextType | undefined>(undefined)

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null)
  const [currentRow, setCurrentRow] = useState<Session | undefined>(undefined)

  return (
    <SessionsContext.Provider value={{ dialogOpen, setDialogOpen, currentRow, setCurrentRow }}>
      {children}
    </SessionsContext.Provider>
  )
}

export function useSessions() {
  const context = useContext(SessionsContext)
  if (!context) {
    throw new Error('useSessions must be used within a SessionsProvider')
  }
  return context
}
