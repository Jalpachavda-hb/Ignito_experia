import React, { useState } from 'react'
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
  const [selectedMode, setSelectedMode] = useState<'gui' | 'headless'>('gui')

  const handleRun = () => {
    onConfirm(selectedMode)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[460px] bg-[#1e1e1e] border-[#3e3e3e] text-slate-100">
        <AlertDialogHeader className="text-start">
          <AlertDialogTitle className="text-lg font-semibold text-slate-100">
            Run Selenium Program
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate-400">
            Choose the execution mode for Chrome browser.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* GUI Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${
              selectedMode === 'gui'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-[#3e3e3e] bg-[#2d2d2d]/30 hover:bg-[#2d2d2d]/50'
            }`}
            onClick={() => setSelectedMode('gui')}
          >
            <input
              type="radio"
              name="executionMode"
              checked={selectedMode === 'gui'}
              onChange={() => setSelectedMode('gui')}
              className="mt-1 accent-sky-500"
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
          </label>

          {/* Headless Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${
              selectedMode === 'headless'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-[#3e3e3e] bg-[#2d2d2d]/30 hover:bg-[#2d2d2d]/50'
            }`}
            onClick={() => setSelectedMode('headless')}
          >
            <input
              type="radio"
              name="executionMode"
              checked={selectedMode === 'headless'}
              onChange={() => setSelectedMode('headless')}
              className="mt-1 accent-sky-500"
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
          </label>
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
