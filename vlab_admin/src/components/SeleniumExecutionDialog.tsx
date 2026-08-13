import React, { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Globe, MonitorPlay } from 'lucide-react'

type SeleniumExecutionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (mode: 'gui' | 'headless') => void
  isLoading?: boolean
}

export function SeleniumExecutionDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: SeleniumExecutionDialogProps) {
  // Load initial mode from localStorage (default to 'gui' if not set)
  const [selectedMode, setSelectedMode] = useState<'gui' | 'headless'>(() => {
    const saved = localStorage.getItem('selenium_execution_mode')
    return saved === 'headless' ? 'headless' : 'gui'
  })

  // Synchronize state with localStorage when open changes
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('selenium_execution_mode')
      if (saved === 'headless' || saved === 'gui') {
        setSelectedMode(saved)
      }
    }
  }, [open])

  const handleRun = () => {
    localStorage.setItem('selenium_execution_mode', selectedMode)
    onConfirm(selectedMode)
  }

  const handleDoubleClick = (mode: 'gui' | 'headless') => {
    if (isLoading) return
    setSelectedMode(mode)
    localStorage.setItem('selenium_execution_mode', mode)
    onConfirm(mode)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[460px] bg-[#1e1e1e] border-[#3e3e3e] text-slate-100">
        <AlertDialogHeader className="text-start">
          <AlertDialogTitle className="text-lg font-semibold text-slate-100">
            Run Selenium Program
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate-400">
            Choose the execution mode for Chrome browser. Double-click any card to run instantly.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* GUI Option */}
          <div
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${
              selectedMode === 'gui'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-[#3e3e3e] bg-[#2d2d2d]/30 hover:bg-[#2d2d2d]/50'
            }`}
            onClick={() => setSelectedMode('gui')}
            onDoubleClick={() => handleDoubleClick('gui')}
          >
            <input
              type="radio"
              name="executionMode"
              checked={selectedMode === 'gui'}
              readOnly
              className="mt-1 accent-sky-500 cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium text-slate-200 text-sm">
                <MonitorPlay className="w-4 h-4 text-sky-400" />
                Run with GUI (Watch Browser)
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Opens the Chrome browser visually inside the container. Best for debugging and watching your automation steps live through the browser preview.
              </p>
            </div>
          </div>

          {/* Headless Option */}
          <div
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${
              selectedMode === 'headless'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-[#3e3e3e] bg-[#2d2d2d]/30 hover:bg-[#2d2d2d]/50'
            }`}
            onClick={() => setSelectedMode('headless')}
            onDoubleClick={() => handleDoubleClick('headless')}
          >
            <input
              type="radio"
              name="executionMode"
              checked={selectedMode === 'headless'}
              readOnly
              className="mt-1 accent-sky-500 cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium text-slate-200 text-sm">
                <Globe className="w-4 h-4 text-sky-400" />
                Run in Headless Mode
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Runs Chrome silently in the background without launching a visual browser. Recommended for faster test runs and lower container resource usage.
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel
            disabled={isLoading}
            className="bg-[#2d2d2d] hover:bg-[#3d3d3d] border-[#3e3e3e] text-slate-300 hover:text-slate-100"
          >
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handleRun}
            disabled={isLoading}
            className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-5"
          >
            {isLoading ? 'Starting...' : 'Run'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
