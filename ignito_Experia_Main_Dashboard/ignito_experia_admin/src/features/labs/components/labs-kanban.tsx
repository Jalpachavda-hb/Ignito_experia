import { useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Clock, Zap, Cpu, Pencil, Trash2, MoreHorizontal, Eye } from 'lucide-react'
import { type Lab } from '../data/schema'
import { useLabs } from '../context/labs-context'
import { useUpdateLabStatusMutation } from '../data/api'

interface LabsKanbanProps {
  data: Lab[]
}

function LabCard({ lab, index }: { lab: Lab; index: number }) {
  const { setDialogOpen, setCurrentRow } = useLabs()
  const statusMutation = useUpdateLabStatusMutation()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleAction = (action: 'view' | 'edit' | 'delete') => {
    setCurrentRow(lab)
    setDialogOpen(action)
    setDropdownOpen(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="glass bg-card/95 border border-border/80 hover:border-primary/50 shadow-sm hover:shadow-lg transition-all duration-200 rounded-2xl p-5 flex flex-col justify-between group cursor-pointer relative"
      onClick={() => handleAction('view')}
    >
      <div>
        {/* Header: Logo, Title, Lab Code & 3-Dots Action Menu */}
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {lab.logoUrl ? (
              <img src={lab.logoUrl} alt={lab.title} className="h-10 w-10 rounded-xl object-cover border border-border/50 shadow-xs flex-shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors truncate leading-tight">
                {lab.title}
              </h3>
              <p className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {lab.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* 3-Dots Menu Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDropdownOpen(!dropdownOpen)
                }}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setDropdownOpen(false) }} />
                  <div className="absolute right-0 top-8 z-30 w-44 glass bg-card rounded-xl border border-border py-1.5 shadow-xl text-xs font-semibold space-y-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAction('view') }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-secondary text-foreground transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      View Details
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAction('edit') }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-secondary text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-primary" />
                      Edit Lab
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        statusMutation.mutate({ labId: lab.id, status: lab.status === 'active' ? 'inactive' : 'active' })
                        setDropdownOpen(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-secondary text-foreground transition-colors"
                    >
                      <span className={`h-2 w-2 rounded-full ${lab.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      Toggle Status ({lab.status === 'active' ? 'Active' : 'Inactive'})
                    </button>
                    <div className="h-px bg-border my-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAction('delete') }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Lab
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Subtitle */}
        {lab.subtitle && (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">
            {lab.subtitle}
          </p>
        )}

        {/* Badges Row: Runtime, Duration, Credits Only */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold tracking-wide">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            {lab.runtimeType?.toUpperCase() || 'IDE'}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60 text-xs font-bold">
            <Clock className="h-3.5 w-3.5 text-sky-500" />
            {lab.durationMinutes} mins
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-bold">
            <Zap className="h-3.5 w-3.5 text-emerald-500" />
            {lab.credits} credits
          </span>
        </div>
      </div>

      {/* Footer Bar: Action Buttons */}
      <div className="flex items-center justify-end pt-3 border-t border-border/60">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); handleAction('edit') }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-primary hover:text-primary-foreground hover:border-primary font-semibold text-xs transition-all shadow-2xs group/edit"
            title="Edit Lab"
          >
            <Pencil className="h-3 w-3 text-primary group-hover/edit:text-primary-foreground transition-colors" />
            <span>Edit</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleAction('delete') }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 font-semibold text-xs transition-all shadow-2xs group/del"
            title="Delete Lab"
          >
            <Trash2 className="h-3 w-3 text-rose-600 dark:text-rose-400 group-hover/del:text-white transition-colors" />
            <span>Delete</span>
          </button>
        </div>
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
        <p className="text-sm font-medium text-muted-foreground">No labs found in this view.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-4">
      {data.map((lab, i) => (
        <LabCard key={lab.id} lab={lab} index={i} />
      ))}
    </div>
  )
}
