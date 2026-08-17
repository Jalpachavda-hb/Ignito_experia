import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, FlaskConical, Clock, Zap, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLabsQuery } from '@/features/labs/data/api'
import { type Lab } from '@/features/labs/data/schema'
import { mapCourseLab } from '@/Utils/PostApiHandler'

interface MapLabDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseName: string
  courseCode: string
  programId?: string
  semesterId?: string
  currentLabName?: string
  currentLabsCount?: number
  onLabsUpdated?: (newCount: number, mappedLabTitle?: string) => void
}

export function MapLabDialog({
  open,
  onOpenChange,
  courseName,
  courseCode,
  programId = '2',
  semesterId = '1',
  currentLabName,
  currentLabsCount = 1,
  onLabsUpdated,
}: MapLabDialogProps) {
  // Fetch real lab data dynamically from API query hook
  const { data: realLabsData = [], isLoading } = useLabsQuery('all')
  const [isSaving, setIsSaving] = useState(false)

  // Real lab data dynamically from API query hook
  const availableLabs: Lab[] = useMemo(() => realLabsData || [], [realLabsData])

  const [searchQuery, setSearchQuery] = useState('')

  // SINGLE SELECT state: exactly ONE lab selected per course!
  const [selectedLabId, setSelectedLabId] = useState<string | null>(() => {
    if (availableLabs.length > 0) {
      // Find matching lab title or default to first lab
      if (currentLabName) {
        const found = availableLabs.find((l) => l.title.toLowerCase() === currentLabName.toLowerCase())
        if (found) return found.id
      }
      return availableLabs[0].id
    }
    return null
  })

  // Filter labs by search query
  const filteredLabs = useMemo(() => {
    return availableLabs.filter((lab) => {
      const q = searchQuery.toLowerCase()
      return (
        lab.title.toLowerCase().includes(q) ||
        (lab.category && lab.category.toLowerCase().includes(q)) ||
        (lab.subtitle && lab.subtitle.toLowerCase().includes(q))
      )
    })
  }, [availableLabs, searchQuery])

  // Select single lab (Radio behavior)
  const handleSelectLab = (labId: string) => {
    setSelectedLabId((prev) => (prev === labId ? null : labId))
  }

  const selectedLab = availableLabs.find((l) => l.id === selectedLabId)

  const handleSave = async () => {
    if (!selectedLabId || !selectedLab) {
      toast.error('Please select one lab to map to this course.')
      return
    }

    try {
      setIsSaving(true)
      await mapCourseLab(courseCode, {
        programId,
        semesterId,
        courseCode,
        labId: selectedLab.id,
        labTitle: selectedLab.title,
        credits: selectedLab.credits || 30,
        durationMinutes: selectedLab.durationMinutes || (selectedLab as any).duration || 90
      })

      toast.success(`Mapped lab "${selectedLab.title}" to ${courseCode}`, {
        description: `Course ${courseName} updated successfully.`,
      })

      if (onLabsUpdated) {
        onLabsUpdated(1, selectedLab.title)
      }
      onOpenChange(false)
    } catch (err: any) {
      console.error('Failed to save lab mapping:', err)
      toast.error('Failed to save lab mapping', { description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-card'>
        {/* MODAL HEADER */}
        <DialogHeader className='p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20 flex flex-col gap-1 text-left shrink-0'>
          <div className='flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold tracking-wider uppercase'>
            <FlaskConical className='h-4 w-4' />
            <span>Virtual Lab Assignment (Single Select)</span>
          </div>

          <DialogTitle className='text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 flex-wrap'>
            <span>Map Lab to</span>
            <span className='text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md text-lg border border-red-200 dark:border-red-800'>
              {courseCode}
            </span>
          </DialogTitle>

          <DialogDescription className='text-muted-foreground text-xs sm:text-sm mt-0.5'>
            Select <strong className='text-foreground font-semibold'>1 virtual lab</strong> to assign to{' '}
            <strong className='text-foreground font-semibold'>{courseName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* SEARCH BAR */}
        <div className='px-5 sm:px-6 py-3 bg-card border-b border-border/50 shrink-0'>
          <div className='relative'>
            <Search className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search virtual labs by title or topic...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9 bg-background shadow-xs text-xs sm:text-sm h-9 rounded-lg border-border/70 focus-visible:ring-red-600'
            />
          </div>
        </div>

        {/* SCROLLABLE LAB LIST AREA */}
        <div className='flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 max-h-[380px] bg-muted/5'>
          {isLoading ? (
            <div className='flex flex-col items-center justify-center py-12 text-muted-foreground gap-2'>
              <Loader2 className='h-7 w-7 animate-spin text-red-600' />
              <p className='text-xs font-medium'>Fetching live labs catalogue...</p>
            </div>
          ) : filteredLabs.length > 0 ? (
            filteredLabs.map((lab) => {
              const isSelected = selectedLabId === lab.id
              return (
                <div
                  key={lab.id}
                  onClick={() => handleSelectLab(lab.id)}
                  className={`group relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                      ? 'border-red-500 bg-red-50/60 dark:bg-red-950/30 shadow-xs ring-1 ring-red-500/40'
                      : 'border-border/70 bg-card hover:bg-muted/30 hover:border-border'
                    }`}
                >
                  {/* Radio Indicator (Single Select) */}
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${isSelected
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-muted-foreground/40 bg-background group-hover:border-foreground/60'
                      }`}
                  >
                    {isSelected && <div className='h-2 w-2 rounded-full bg-white' />}
                  </div>

                  {/* Lab Information */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between gap-2 flex-wrap'>
                      <h4
                        className={`font-bold text-sm ${isSelected ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                          }`}
                      >
                        {lab.title}
                      </h4>
                      <Badge
                        variant='outline'
                        className='text-[10px] font-normal shrink-0 capitalize bg-background px-2 py-0.5'
                      >
                        {lab.category || 'Development'}
                      </Badge>
                    </div>

                    <p className='text-xs text-muted-foreground mt-1 line-clamp-1'>
                      {lab.subtitle || 'Hands-on interactive virtual workspace for students.'}
                    </p>

                    <div className='flex items-center gap-4 mt-2.5 text-xs text-muted-foreground flex-wrap'>
                      <span className='flex items-center gap-1 font-medium'>
                        <Clock className='h-3.5 w-3.5 text-amber-500' />
                        {lab.durationMinutes || 60} mins
                      </span>
                      <span className='flex items-center gap-1 font-medium'>
                        <Zap className='h-3.5 w-3.5 text-emerald-500' />
                        {lab.credits || 30} Credits
                      </span>
                      <span className='capitalize font-medium text-foreground/80 bg-muted/60 px-2 py-0.5 rounded text-[11px]'>
                        Level: {lab.complexity || 'Intermediate'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className='text-center py-12 text-muted-foreground'>
              <ShieldAlert className='mx-auto h-9 w-9 text-muted-foreground/50 mb-2' />
              <p className='text-sm font-semibold text-foreground'>No virtual labs found</p>
              <p className='text-xs text-muted-foreground mt-1'>Try adjusting your search query.</p>
            </div>
          )}
        </div>

        {/* PINNED FOOTER */}
        <div className='p-4 px-6 bg-card border-t border-border/80 flex items-center justify-between gap-4 shrink-0 rounded-b-2xl'>
          <div className='flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground'>
            <CheckCircle2 className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
            <span>
              {selectedLab ? (
                <span>
                  Selected: <strong className='text-foreground font-bold'>{selectedLab.title}</strong>
                </span>
              ) : (
                <span className='text-amber-600 font-semibold'>No lab selected</span>
              )}
            </span>
          </div>

          <div className='flex items-center gap-2.5'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => onOpenChange(false)}
              className='h-9 px-4 text-xs font-medium cursor-pointer'
            >
              Cancel
            </Button>

            <Button
              type='button'
              size='sm'
              disabled={!selectedLabId}
              onClick={handleSave}
              className='h-9 px-4 text-xs font-semibold gap-1.5 bg-[#c5192d] hover:bg-[#a81426] text-white shadow-md cursor-pointer transition-transform hover:scale-[1.01] disabled:opacity-50'
            >
              <FlaskConical className='h-3.5 w-3.5' />
              Save Lab Mapping
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
