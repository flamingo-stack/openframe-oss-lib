'use client'

/**
 * Shared filter section wrapper with responsive layout.
 *
 * Provides the consistent card container for any filter row (status,
 * platform, section, etc.) Single row on desktop with flex-wrap,
 * stacks naturally on mobile.
 *
 * Lifted from hub `components/admin/shared/filter-section.tsx` so
 * lib catalog views can render their own filter pills without an
 * injected slot.
 */

import { Filter } from 'lucide-react'
import { Button } from './button'

export interface FilterPillRowOption {
  value: string
  label: string
}

export interface FilterPillRowProps {
  /** Label shown next to the filter icon, e.g. "Section", "Platform". */
  label: string
  /** The currently selected filter value. */
  selectedValue: string
  /** Callback when a filter option is selected. */
  onValueChange: (value: string) => void
  /** Available filter options. */
  options: FilterPillRowOption[]
  /** Optional count label, e.g. "Showing 1-10 of 42 items". */
  countLabel?: string
  /** Optional children to render instead of options (for custom filter content). */
  children?: React.ReactNode
}

export function FilterPillRow({
  label,
  selectedValue,
  onValueChange,
  options,
  countLabel,
  children,
}: FilterPillRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-ods-card border border-ods-border rounded-lg">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-ods-accent" />
        <span className="text-h5 text-ods-text-secondary">{label}</span>
      </div>
      {children ||
        options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={selectedValue === opt.value ? 'accent' : 'outline'}
            size="small-legacy"
            onClick={() => onValueChange(opt.value)}
            className="text-h3"
          >
            {opt.label}
          </Button>
        ))}
      {countLabel && (
        <div className="ml-auto text-[12px] font-['DM_Sans'] text-ods-text-secondary shrink-0">
          {countLabel}
        </div>
      )}
    </div>
  )
}
