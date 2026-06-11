import React, { createContext, useContext, useState } from 'react'
import { type Program } from '../data/schema'

type DialogType = 'create' | 'edit' | 'delete' | null

interface ProgramsContextType {
  dialogOpen: DialogType
  setDialogOpen: (open: DialogType) => void
  currentRow: Program | undefined
  setCurrentRow: (row: Program | undefined) => void
}

const ProgramsContext = createContext<ProgramsContextType | undefined>(undefined)

export function ProgramsProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null)
  const [currentRow, setCurrentRow] = useState<Program | undefined>(undefined)

  return (
    <ProgramsContext.Provider value={{ dialogOpen, setDialogOpen, currentRow, setCurrentRow }}>
      {children}
    </ProgramsContext.Provider>
  )
}

export function usePrograms() {
  const context = useContext(ProgramsContext)
  if (!context) {
    throw new Error('usePrograms must be used within a ProgramsProvider')
  }
  return context
}
