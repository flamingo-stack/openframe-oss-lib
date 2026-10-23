'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

export interface InfoCardRowSection {
  title: string;
  caption: string;
  icon?: ReactNode;
}

export interface InfoCardRowProps {
  lead: InfoCardRowSection;
  stats: [InfoCardRowSection, InfoCardRowSection];
  className?: string;
}

const CELL =
  'flex items-center gap-[var(--spacing-system-s)] min-w-0 p-[var(--spacing-system-xsf)] content-md:p-[var(--spacing-system-m)] min-h-[60px] content-md:min-h-[76px]';

/** The row's frame, lead and stat cells, read by the row and by its skeleton. */
const FRAME_CLASS =
  'flex shrink-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card content-md:flex-row';
const LEAD_CELL_CLASS = 'border-b border-ods-border content-md:flex-1 content-md:border-b-0 content-md:border-r';
const LEAD_ICON_CLASS =
  'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-ods-border [&>*]:size-full [&_img]:object-cover';
const LEAD_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col justify-center';
const STATS_CLASS = 'flex content-md:flex-1';
const STAT_DIVIDER_CLASS = 'border-r border-ods-border';
const STAT_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col';
const STAT_TITLE_CLASS = 'truncate uppercase text-ods-text-secondary text-h5';

function StatCell({ section, className }: { section: InfoCardRowSection; className?: string }) {
  return (
    <div className={cn(CELL, 'flex-1', className)}>
      <div className={STAT_TEXT_CLASS}>
        <p className={STAT_TITLE_CLASS}>{section.title}</p>
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-s)]">
          <p className="min-w-0 flex-1 truncate text-ods-text-primary text-h3">{section.caption}</p>
          {section.icon && (
            <div className="flex size-6 shrink-0 items-center justify-center content-md:hidden">{section.icon}</div>
          )}
        </div>
      </div>
      {section.icon && (
        <div className="hidden size-6 shrink-0 items-center justify-center content-md:flex">{section.icon}</div>
      )}
    </div>
  );
}

export function InfoCardRow({ lead, stats, className }: InfoCardRowProps) {
  // In a page's loading state the row's figures are read (its lead title is empty): the row is its skeleton.
  const inScope = useLoadingScope();
  if (inScope && !lead.title) {
    return (
      <InfoCardRowSkeleton
        leadIcon={Boolean(lead.icon)}
        statTitles={[stats[0].title, stats[1].title]}
        className={className}
      />
    );
  }
  return (
    <div className={cn(FRAME_CLASS, className)}>
      <div className={cn(CELL, LEAD_CELL_CLASS)}>
        {lead.icon && <div className={LEAD_ICON_CLASS}>{lead.icon}</div>}
        <div className={LEAD_TEXT_CLASS}>
          <p className="truncate text-ods-text-primary text-h3">{lead.title}</p>
          <p className="truncate text-ods-text-secondary text-h6">{lead.caption}</p>
        </div>
      </div>

      <div className={STATS_CLASS}>
        <StatCell section={stats[0]} className={STAT_DIVIDER_CLASS} />
        <StatCell section={stats[1]} />
      </div>
    </div>
  );
}

/**
 * An InfoCardRow while its figures are read: the same frame and cells, the lead's picture a box and its two
 * lines bars, each stat's caption a `text-h3` bar under its title (the page's own label, drawn for real when it
 * is given, else a bar).
 */
function InfoCardRowSkeleton({
  leadIcon = true,
  statTitles = ['', ''],
  className,
}: {
  /** The loaded row leads with a picture. Default `true`. */
  leadIcon?: boolean;
  /** The stats' own titles (static labels). Empty ones are bars. */
  statTitles?: [string, string];
  className?: string;
}) {
  return (
    <div className={cn(FRAME_CLASS, className)} aria-hidden>
      <div className={cn(CELL, LEAD_CELL_CLASS)}>
        {leadIcon && <UnifiedSkeleton className={LEAD_ICON_CLASS} />}
        <div className={LEAD_TEXT_CLASS}>
          <TextLineSkeleton type="h3" className="w-1/2" />
          <TextLineSkeleton type="h6" className="w-1/3" />
        </div>
      </div>
      <div className={STATS_CLASS}>
        {statTitles.map((title, index) => (
          <div key={index} className={cn(CELL, 'flex-1', index === 0 && STAT_DIVIDER_CLASS)}>
            <div className={STAT_TEXT_CLASS}>
              {title ? <p className={STAT_TITLE_CLASS}>{title}</p> : <TextLineSkeleton type="h5" className="w-16" />}
              <TextLineSkeleton type="h3" className="w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
