import { SignalHigh, SignalLow, SignalMedium } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Lab } from '../types'

// Style by level order (1 = foundation, 2 = intermediate, 3 = advanced), not by hard-coded names.
const LEVEL_STYLES: Record<number, { className: string; Icon: typeof SignalLow }> = {
  1: {
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    Icon: SignalLow,
  },
  2: {
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    Icon: SignalMedium,
  },
  3: {
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    Icon: SignalHigh,
  },
}

/** Level badge: text and a bars icon (not colour alone). Tooltip = levelNote. */
export function LabLevelBadge({ lab, className = '' }: { lab: Lab; className?: string }) {
  if (!lab.levelLabel) return null
  const style = LEVEL_STYLES[Number(lab.levelOrder)] || LEVEL_STYLES[2]
  const { Icon } = style
  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.className} ${className}`}
      aria-label={`Level: ${lab.levelLabel}`}
    >
      <Icon className='h-3 w-3 shrink-0' aria-hidden='true' />
      {lab.levelLabel}
    </span>
  )
  if (!lab.levelNote) return badge
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className='max-w-xs text-xs'>{lab.levelNote}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** "New" / "Beta" ribbon from catalogStatus. */
export function LabCatalogRibbon({ lab }: { lab: Lab }) {
  const status = String(lab.catalogStatus || '').toLowerCase()
  if (status !== 'new' && status !== 'beta') return null
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm ${
        status === 'new' ? 'bg-red-600' : 'bg-slate-700'
      }`}
    >
      {status === 'new' ? 'New' : 'Beta'}
    </span>
  )
}
