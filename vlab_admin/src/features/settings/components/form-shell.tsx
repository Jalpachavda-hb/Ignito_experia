import React from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Save, RefreshCcw } from 'lucide-react'

interface FormShellProps {
  title: string
  description: string
  children: React.ReactNode
  isDirty?: boolean
  onReset?: () => void
  onSubmit?: (e: React.FormEvent) => void
}

export function FormShell({ title, description, children, isDirty, onReset, onSubmit }: FormShellProps) {
  
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (onSubmit) {
      onSubmit(e)
    } else {
      toast.promise(sleep(1000), {
        loading: 'Saving configuration...',
        success: 'Settings updated successfully.',
        error: 'Failed to update settings',
      })
    }
  }

  return (
    <form onSubmit={handleFormSubmit} className="relative flex flex-col h-full">
      <div className="flex-1 pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        
        <div className="space-y-8">
          {children}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 left-0 right-0 p-4 mt-6 bg-background/80 backdrop-blur-md border-t flex items-center justify-between z-10 rounded-b-xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        <div className="text-sm text-muted-foreground">
          {isDirty ? (
            <span className="text-amber-500 font-medium flex items-center">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Unsaved changes
            </span>
          ) : (
            'All changes saved'
          )}
        </div>
        <div className="flex items-center gap-2">
          {onReset && (
            <Button type="button" variant="ghost" onClick={onReset} disabled={!isDirty}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
          <Button type="submit" disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </form>
  )
}
