import React, { createContext, useContext, useState } from 'react'
import { type Semester } from '../data/schema'

type DialogType = 'create' | 'edit' | 'delete' | null

interface SemestersContextType {
  dialogOpen: DialogType
  setDialogOpen: (open: DialogType) => void
  currentRow: Semester | undefined
  setCurrentRow: (row: Semester | undefined) => void
}

const SemestersContext = createContext<SemestersContextType | undefined>(undefined)

export function SemestersProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null)
  const [currentRow, setCurrentRow] = useState<Semester | undefined>(undefined)

  return (
    <SemestersContext.Provider value={{ dialogOpen, setDialogOpen, currentRow, setCurrentRow }}>
      {children}
    </SemestersContext.Provider>
  )
}

export function useSemesters() {
  const context = useContext(SemestersContext)
  if (!context) {
    throw new Error('useSemesters must be used within a SemestersProvider')
  }
  return context
}
