import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LabLevelInfo } from '@/stores/labStore'
import type { Lab } from '../types'

export interface LabCatalogFilterState {
  levels: string[]
  category: string
  kind: string
}

export const EMPTY_CATALOG_FILTERS: LabCatalogFilterState = { levels: [], category: 'all', kind: 'all' }

const KIND_OPTIONS = [
  { value: 'all', label: 'All lab types' },
  { value: 'container', label: 'Hands-on environment' },
  { value: 'aws-console', label: 'Cloud console' },
]

/** Filters (level multi-select, category, kind), hides retired labs, sorts by level order then title. */
export function applyCatalogFilters<T extends Lab>(labs: T[], filters: LabCatalogFilterState): T[] {
  return labs
    .filter((l) => String(l.catalogStatus || '').toLowerCase() !== 'retired')
    .filter((l) => !filters.levels.length || filters.levels.includes(String(l.level)))
    .filter((l) => filters.category === 'all' || String(l.category) === filters.category)
    .filter((l) => filters.kind === 'all' || String(l.kind || 'container') === filters.kind)
    .sort(
      (a, b) =>
        (Number(a.levelOrder) || 99) - (Number(b.levelOrder) || 99) ||
        String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''))
    )
}

interface Props {
  labs: Lab[]
  levels: Record<string, LabLevelInfo>
  value: LabCatalogFilterState
  onChange: (next: LabCatalogFilterState) => void
}

export function LabCatalogFilters({ labs, levels, value, onChange }: Props) {
  const levelEntries = Object.entries(levels).sort(([, a], [, b]) => a.order - b.order)
  const categories = Array.from(new Set(labs.map((l) => l.category).filter(Boolean) as string[])).sort()
  const hasAwsLabs = labs.some((l) => l.kind === 'aws-console')
  const isFiltered = value.levels.length > 0 || value.category !== 'all' || value.kind !== 'all'

  const toggleLevel = (key: string) =>
    onChange({
      ...value,
      levels: value.levels.includes(key) ? value.levels.filter((l) => l !== key) : [...value.levels, key],
    })

  return (
    <div className='mb-6 flex flex-wrap items-center gap-3'>
      {levelEntries.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5' role='group' aria-label='Filter by level'>
          <span className='text-xs font-semibold text-muted-foreground mr-1'>Level</span>
          {levelEntries.map(([key, info]) => {
            const active = value.levels.includes(key)
            return (
              <button
                key={key}
                type='button'
                aria-pressed={active}
                title={info.description}
                onClick={() => toggleLevel(key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-border bg-white text-slate-600 hover:border-slate-400 dark:bg-card dark:text-slate-300'
                }`}
              >
                {info.label}
              </button>
            )
          })}
        </div>
      )}

      {categories.length > 1 && (
        <Select value={value.category} onValueChange={(category) => onChange({ ...value, category })}>
          <SelectTrigger className='h-8 w-[180px] text-xs' aria-label='Filter by category'>
            <SelectValue placeholder='Category' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasAwsLabs && (
        <Select value={value.kind} onValueChange={(kind) => onChange({ ...value, kind })}>
          <SelectTrigger className='h-8 w-[190px] text-xs' aria-label='Filter by lab type'>
            <SelectValue placeholder='Lab type' />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isFiltered && (
        <button
          type='button'
          onClick={() => onChange(EMPTY_CATALOG_FILTERS)}
          className='text-xs font-semibold text-red-600 hover:underline'
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
