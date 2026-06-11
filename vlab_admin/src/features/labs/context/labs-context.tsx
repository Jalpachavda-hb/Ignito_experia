import React, { createContext, useContext, useState } from 'react'
import { type Lab } from '../data/schema'

type DialogType = 'view' | 'create' | 'edit' | 'clone' | 'delete' | null

interface LabsContextType {
  dialogOpen: DialogType
  setDialogOpen: (open: DialogType) => void
  currentRow: Lab | undefined
  setCurrentRow: (row: Lab | undefined) => void
}

const LabsContext = createContext<LabsContextType | undefined>(undefined)

export function LabsProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null)
  const [currentRow, setCurrentRow] = useState<Lab | undefined>(undefined)

  return (
    <LabsContext.Provider value={{ dialogOpen, setDialogOpen, currentRow, setCurrentRow }}>
      {children}
    </LabsContext.Provider>
  )
}

export function useLabs() {
  const context = useContext(LabsContext)
  if (!context) {
    throw new Error('useLabs must be used within a LabsProvider')
  }
  return context
}
