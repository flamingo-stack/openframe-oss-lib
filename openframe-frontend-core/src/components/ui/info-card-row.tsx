import type * as React from 'react'
import { cn } from '../../utils/cn'

export interface InfoCardRowSection {
  title: string
  caption: string
  icon?: React.ReactNode
}

export interface InfoCardRowProps {
  lead: InfoCardRowSection
  stats: [InfoCardRowSection, InfoCardRowSection]
  className?: string
}

const CELL =
  'flex items-center gap-[var(--spacing-system-s)] min-w-0 p-[var(--spacing-system-xsf)] md:p-[var(--spacing-system-m)] min-h-[60px] md:min-h-[76px]'

function StatCell({ section, className }: { section: InfoCardRowSection; className?: string }) {
  return (
    <div className={cn(CELL, 'flex-1', className)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-h5 uppercase text-ods-text-secondary">{section.title}</p>
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-s)]">
          <p className="min-w-0 flex-1 truncate text-h3 text-ods-text-primary">
            {section.caption}
          </p>
          {section.icon && (
            <div className="flex size-6 shrink-0 items-center justify-center md:hidden">
              {section.icon}
            </div>
          )}
        </div>
      </div>
      {section.icon && (
        <div className="hidden size-6 shrink-0 items-center justify-center md:flex">
          {section.icon}
        </div>
      )}
    </div>
  )
}

export function InfoCardRow({ lead, stats, className }: InfoCardRowProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card md:flex-row',
        className,
      )}
    >
      <div className={cn(CELL, 'border-b border-ods-border md:flex-1 md:border-b-0 md:border-r')}>
        {lead.icon && (
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-ods-border [&>*]:size-full [&_img]:object-cover">
            {lead.icon}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-h3 text-ods-text-primary">{lead.title}</p>
          <p className="truncate text-h6 text-ods-text-secondary">{lead.caption}</p>
        </div>
      </div>

      <div className="flex md:flex-1">
        <StatCell section={stats[0]} className="border-r border-ods-border" />
        <StatCell section={stats[1]} />
      </div>
    </div>
  )
}
