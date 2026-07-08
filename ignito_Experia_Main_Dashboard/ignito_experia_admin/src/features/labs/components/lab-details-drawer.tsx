import { Pencil, Trash2, FlaskConical, Clock, Zap, Cpu, CalendarDays } from 'lucide-react'
import { type Lab } from '../data/schema'
import { cn, formatDateTime } from '@/lib/utils'
import { Sheet, SheetContent } from '@/components/ui/sheet'

interface LabDetailsDrawerProps {
  lab: Lab
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

export function LabDetailsDrawer({ lab, open, onOpenChange, onEdit, onDelete }: LabDetailsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col p-0 border-l border-border bg-background">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            {lab.logoUrl ? (
              <img src={lab.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover animate-in fade-in" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-foreground">{lab.title}</h2>
              <p className="text-[10px] text-muted-foreground font-mono">{lab.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-6">
            <button onClick={onEdit} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors" title="Edit">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={onDelete} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors" title="Delete">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
              lab.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-secondary text-muted-foreground border-border'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', lab.status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground')} />
              {lab.status?.charAt(0).toUpperCase() + lab.status?.slice(1)}
            </span>
            {lab.category && (
              <span className="px-3 py-1 rounded-full text-xs border border-border bg-secondary text-foreground">{lab.category}</span>
            )}
          </div>

          {lab.description && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</h3>
              <p className="text-sm text-foreground leading-relaxed">{lab.description}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Zap, label: 'Credits', value: lab.credits },
              { icon: Clock, label: 'Duration', value: `${lab.durationMinutes} min` },
              { icon: Cpu, label: 'Runtime', value: lab.runtimeType?.toUpperCase() || 'IDE' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="glass rounded-xl p-3 text-center border border-border">
                <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-base font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Configuration</h3>
            <div className="space-y-2">
              {[
                { label: 'Task Definition', value: lab.taskDefinition },
                { label: 'Runtime Path', value: lab.runtimePath },
                { label: 'Runtime Port', value: lab.runtimePort ? String(lab.runtimePort) : null },
                { label: 'Semester', value: lab.semester },
                { label: 'Complexity', value: lab.complexity },
                { label: 'Display Order', value: String(lab.displayOrder ?? 0) },
              ].filter(item => item.value).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-medium text-foreground font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Audit</h3>
            <div className="space-y-2">
              {lab.createdAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  <span>Created {formatDateTime(lab.createdAt)}</span>
                </div>
              )}
              {lab.updatedAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  <span>Updated {formatDateTime(lab.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
