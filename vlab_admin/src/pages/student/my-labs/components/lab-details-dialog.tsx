import { useState } from 'react'
import { AlertTriangle, ChevronDown, Clock, ListChecks, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Lab } from '../types'
import { LabCatalogRibbon, LabLevelBadge } from './lab-catalog-badges'

interface Props {
  lab: Lab | null
  allLabs: Lab[]
  completedLabIds: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectLab: (labId: string) => void
}

const labName = (labs: Lab[], id: string) => {
  const found = labs.find((l) => l.id === id)
  return found?.title || found?.name || id
}

/** Lab details: what you'll practise, not included, recommended before, continue with, duration. */
export function LabDetailsDialog({ lab, allLabs, completedLabIds, open, onOpenChange, onSelectLab }: Props) {
  const [showNotCovered, setShowNotCovered] = useState(false)
  if (!lab) return null

  const topics = lab.topics || []
  const notCovered = lab.notCovered || []
  const prerequisites = lab.prerequisites || []
  const nextLabs = lab.nextLabs || []
  const missingPrereqs = prerequisites.filter((id) => !completedLabIds.has(id))
  const duration = lab.durationMinutes ?? lab.duration

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex flex-wrap items-center gap-2'>
            <LabLevelBadge lab={lab} />
            <LabCatalogRibbon lab={lab} />
            {lab.category && <span className='text-xs font-semibold text-muted-foreground'>{lab.category}</span>}
          </div>
          <DialogTitle className='text-xl'>{lab.title || lab.name}</DialogTitle>
          {lab.description && <DialogDescription>{lab.description}</DialogDescription>}
        </DialogHeader>

        <div className='space-y-5 text-sm'>
          {duration ? (
            <p className='flex items-center gap-2 text-muted-foreground'>
              <Clock className='h-4 w-4' /> {duration} minutes
            </p>
          ) : null}

          {lab.levelNote && <p className='text-muted-foreground'>{lab.levelNote}</p>}

          {missingPrereqs.length > 0 && (
            <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'>
              <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
              <p>
                We recommend finishing {missingPrereqs.map((id) => labName(allLabs, id)).join(', ')} first. You can
                still start this lab.
              </p>
            </div>
          )}

          {topics.length > 0 && (
            <section>
              <h3 className='mb-2 flex items-center gap-2 font-semibold'>
                <ListChecks className='h-4 w-4' /> What you'll practise
              </h3>
              <ul className='list-disc space-y-1 pl-5'>
                {topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {notCovered.length > 0 && (
            <Collapsible open={showNotCovered} onOpenChange={setShowNotCovered}>
              <CollapsibleTrigger className='flex items-center gap-1 font-semibold'>
                Not included in this lab
                <ChevronDown className={`h-4 w-4 transition-transform ${showNotCovered ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className='mt-2 list-disc space-y-1 pl-5 text-muted-foreground'>
                  {notCovered.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}

          {prerequisites.length > 0 && (
            <section>
              <h3 className='mb-2 font-semibold'>Recommended before</h3>
              <div className='flex flex-wrap gap-2'>
                {prerequisites.map((id) => (
                  <button
                    key={id}
                    type='button'
                    onClick={() => onSelectLab(id)}
                    className='rounded-full border px-3 py-1 text-xs font-semibold hover:border-slate-400'
                  >
                    {completedLabIds.has(id) ? '✓ ' : ''}
                    {labName(allLabs, id)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {nextLabs.length > 0 && (
            <section>
              <h3 className='mb-2 font-semibold'>Continue with</h3>
              <div className='flex flex-wrap gap-2'>
                {nextLabs.map((id) => (
                  <button
                    key={id}
                    type='button'
                    onClick={() => onSelectLab(id)}
                    className='inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:border-slate-400'
                  >
                    {labName(allLabs, id)} <ArrowRight className='h-3 w-3' />
                  </button>
                ))}
              </div>
            </section>
          )}

          {!topics.length && !notCovered.length && !prerequisites.length && !nextLabs.length && (
            <p className='text-muted-foreground'>More details about this lab will be added soon.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
