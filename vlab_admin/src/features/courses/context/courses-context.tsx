import React, { createContext, useContext, useState } from 'react'
import { type Course } from '../data/schema'

type DialogType = 'create' | 'edit' | 'delete' | 'assign-labs' | null

interface CoursesContextType {
  dialogOpen: DialogType
  setDialogOpen: (open: DialogType) => void
  currentRow: Course | undefined
  setCurrentRow: (row: Course | undefined) => void
}

const CoursesContext = createContext<CoursesContextType | undefined>(undefined)

export function CoursesProvider({ children }: { children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState<DialogType>(null)
  const [currentRow, setCurrentRow] = useState<Course | undefined>(undefined)

  return (
    <CoursesContext.Provider value={{ dialogOpen, setDialogOpen, currentRow, setCurrentRow }}>
      {children}
    </CoursesContext.Provider>
  )
}

export function useCourses() {
  const context = useContext(CoursesContext)
  if (!context) {
    throw new Error('useCourses must be used within a CoursesProvider')
  }
  return context
}
