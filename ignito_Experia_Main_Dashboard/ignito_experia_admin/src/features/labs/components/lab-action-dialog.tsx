import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { type Lab, labSchema } from '../data/schema'
import { useCreateLabMutation, useUpdateLabMutation, useRuntimeTypesQuery } from '../data/api'
import { cn } from '@/lib/utils'



const formSchema = labSchema
  .omit({
    createdAt: true,
    updatedAt: true,
    isDeleted: true,
    dbId: true,
  })
  .extend({
    isEdit: z.boolean(),
  });

type LabFormInput = z.input<typeof formSchema>;
type LabFormOutput = z.output<typeof formSchema>;

interface LabActionDialogProps {
  currentRow?: Lab
  mode: 'create' | 'edit' | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LabActionDialog({ currentRow, mode, open, onOpenChange }: LabActionDialogProps) {
  const isEdit = mode === 'edit'
  const createMutation = useCreateLabMutation()
  const updateMutation = useUpdateLabMutation()
  const { data: runtimeTypes = [] } = useRuntimeTypesQuery()

  const form = useForm<LabFormInput, any, LabFormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: '', title: '', subtitle: '', semester: '', logoUrl: '',
      category: '', credits: 100, durationMinutes: 60, complexity: 'Intermediate',
      runtimeType: 'ide', runtimePort: 8080, runtimePath: '/workspace',
      containerApiEnabled: false, containerApiPort: null,
      taskDefinition: '', description: '', status: 'active',
      displayOrder: 0, isEdit: false,
    },
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && currentRow) {
      form.reset({
        id: currentRow.id,
        title: currentRow.title,
        subtitle: currentRow.subtitle || '',
        semester: currentRow.semester || '',
        logoUrl: currentRow.logoUrl || '',
        category: currentRow.category || '',
        credits: currentRow.credits || 0,
        durationMinutes: currentRow.durationMinutes || 60,
        complexity: currentRow.complexity || 'Intermediate',
        runtimeType: currentRow.runtimeType || 'ide',
        runtimePort: currentRow.runtimePort || null,
        runtimePath: currentRow.runtimePath || '/workspace',
        containerApiEnabled: currentRow.containerApiEnabled || false,
        containerApiPort: currentRow.containerApiPort || null,
        taskDefinition: currentRow.taskDefinition || '',
        description: currentRow.description || '',
        status: currentRow.status || 'active',
        displayOrder: currentRow.displayOrder || 0,
        isEdit: true,
      })
    } else {
      form.reset({
        id: '', title: '', subtitle: '', semester: '', logoUrl: '',
        category: '', credits: 100, durationMinutes: 60, complexity: 'Intermediate',
        runtimeType: 'ide', runtimePort: 8080, runtimePath: '/workspace',
        containerApiEnabled: false, containerApiPort: null,
        taskDefinition: '', description: '', status: 'active',
        displayOrder: 0, isEdit: false,
      })
    }
  }, [open, currentRow, isEdit, form])

  const onSubmit = async (values: LabFormOutput) => {
    try {
      if (isEdit && currentRow) {
        await updateMutation.mutateAsync({ labId: currentRow.id, payload: values })
      } else {
        await createMutation.mutateAsync(values)
      }
      onOpenChange(false)
    } catch {
      toast.error('Failed to save lab.')
    }
  }

  if (!open) return null

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative glass rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? 'Edit Lab Configuration' : 'Create New Lab'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit ? 'Modify the settings for this lab.' : 'Configure a new lab environment for the global catalog.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="lab-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">General Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Lab Code" error={form.formState.errors.id?.message}>
                  <input {...form.register('id')} disabled={isEdit} placeholder="e.g. PYTHON-LAB-01"
                    className={inputCls(!!form.formState.errors.id)} />
                </Field>
                <Field label="Title" error={form.formState.errors.title?.message}>
                  <input {...form.register('title')} placeholder="Lab Title" className={inputCls(!!form.formState.errors.title)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Subtitle">
                  <input {...form.register('subtitle')} placeholder="Brief subtitle" className={inputCls()} />
                </Field>
                <Field label="Semester">
                  <input {...form.register('semester')} placeholder="e.g. Semester 1" className={inputCls()} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Logo URL">
                  <input {...form.register('logoUrl')} placeholder="https://..." className={inputCls()} />
                </Field>
                <Field label="Category">
                  <input {...form.register('category')} placeholder="e.g. Data Science" className={inputCls()} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Complexity">
                  <input {...form.register('complexity')} placeholder="e.g. Beginner, Intermediate" className={inputCls()} />
                </Field>
                <Field label="Display Order">
                  <input type="number" {...form.register('displayOrder', { valueAsNumber: true })} className={inputCls()} />
                </Field>
              </div>
              <Field label="Description">
                <textarea {...form.register('description')} placeholder="Lab description..." rows={3}
                  className={cn(inputCls(), 'resize-none')} />
              </Field>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Environment & Billing</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Credit Cost">
                  <input type="number" min={0} {...form.register('credits', { valueAsNumber: true })} className={inputCls()} />
                </Field>
                <Field label="Duration (Minutes)">
                  <input type="number" min={15} step={15} {...form.register('durationMinutes', { valueAsNumber: true })} className={inputCls()} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Runtime Type" error={form.formState.errors.runtimeType?.message}>
                  <select {...form.register('runtimeType')} className={cn(inputCls(!!form.formState.errors.runtimeType), 'appearance-none')}>
                    <option value="">Select Runtime</option>
                    {runtimeTypes.length > 0
                      ? runtimeTypes.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)
                      : ['ide', 'terminal', 'jupyter'].map(v => (
                        <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                      ))
                    }
                  </select>
                </Field>
                <Field label="Port">
                  <input
                    type="number"
                    {...form.register("runtimePort", {
                      setValueAs: (v) => (v === "" ? null : Number(v)),
                    })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Runtime Path">
                  <input {...form.register('runtimePath')} placeholder="/workspace" className={inputCls()} />
                </Field>
                <Field label="Task Definition (Docker Image)">
                  <input {...form.register('taskDefinition')} placeholder="e.g. ubuntu:latest" className={inputCls()} />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="containerApiEnabled" {...form.register('containerApiEnabled')}
                  className="h-4 w-4 rounded border-border bg-secondary accent-primary" />
                <label htmlFor="containerApiEnabled" className="text-sm text-foreground">Enable Container API</label>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Status</h3>
              <Field label="Lab Status">
                <select {...form.register('status')} className={cn(inputCls(), 'appearance-none')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </Field>
            </section>
          </form>
        </div>

        <div className="p-6 border-t border-border flex items-center justify-end gap-3">
          <button type="button" onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="submit" form="lab-form" disabled={isPending}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPending ? 'Saving...' : 'Save Lab Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  )
}

function inputCls(hasError = false) {
  return cn(
    'w-full px-3 py-2 rounded-xl bg-secondary border text-sm transition-all',
    'focus:outline-none focus:ring-2 focus:ring-primary/40',
    hasError ? 'border-destructive' : 'border-border'
  )
}
