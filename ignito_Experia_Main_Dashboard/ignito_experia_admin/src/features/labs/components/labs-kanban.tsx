import { motion } from 'framer-motion'
import { FlaskConical, Clock, Zap, Cpu } from 'lucide-react'
import { type Lab } from '../data/schema'
import { useLabs } from '../context/labs-context'
import { useUpdateLabStatusMutation } from '../data/api'
import { cn } from '@/lib/utils'

interface LabsKanbanProps {
  data: Lab[]
}

function LabCard({ lab, index }: { lab: Lab; index: number }) {
  const { setDialogOpen, setCurrentRow } = useLabs()
  const statusMutation = useUpdateLabStatusMutation()

  const handleAction = (action: 'view' | 'edit' | 'delete') => {
    setCurrentRow(lab)
    setDialogOpen(action)
  }

  const complexityColor = {
    Beginner: 'text-emerald-400 bg-emerald-500/10',
    Intermediate: 'text-amber-400 bg-amber-500/10',
    Advanced: 'text-red-400 bg-red-500/10',
  }[lab.complexity || 'Intermediate'] || 'text-muted-foreground bg-secondary'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="glass rounded-2xl p-4 border border-border hover:border-primary/30 transition-all group cursor-pointer"
      onClick={() => handleAction('view')}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {lab.logoUrl ? (
            <img src={lab.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {lab.title}
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono">{lab.id}</p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            statusMutation.mutate({ labId: lab.id, status: lab.status === 'active' ? 'inactive' : 'active' })
          }}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all',
            lab.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-secondary text-muted-foreground border-border'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', lab.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground')} />
          {lab.status === 'active' ? 'Active' : 'Inactive'}
        </button>
      </div>

      {lab.subtitle && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{lab.subtitle}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[10px] text-muted-foreground border border-border">
          <Cpu className="h-2.5 w-2.5" />
          {lab.runtimeType?.toUpperCase() || 'IDE'}
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[10px] text-muted-foreground border border-border">
          <Clock className="h-2.5 w-2.5" />
          {lab.durationMinutes} min
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[10px] text-muted-foreground border border-border">
          <Zap className="h-2.5 w-2.5" />
          {lab.credits} cr
        </span>
        {lab.complexity && (
          <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-medium', complexityColor)}>
            {lab.complexity}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => { e.stopPropagation(); handleAction('edit') }}
          className="flex-1 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleAction('delete') }}
          className="flex-1 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-colors"
        >
          Delete
        </button>
      </div>
    </motion.div>
  )
}

export function LabsKanban({ data }: LabsKanbanProps) {
  if (data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-3">
        <div className="h-16 w-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
          <FlaskConical className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No labs found in this view.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
      {data.map((lab, i) => (
        <LabCard key={lab.id} lab={lab} index={i} />
      ))}
    </div>
  )
}
