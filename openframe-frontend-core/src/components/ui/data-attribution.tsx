import type { ReactNode } from 'react';
import { formatDate } from '../../utils/format';

export interface DataAttributionProps {
  /** The source's mark, sized by the caller (e.g. `<CartaIcon className="h-4 w-4" />`). */
  icon?: ReactNode;
  /** The system the data is read from ("Carta", "QuickBooks", "Vanta"). */
  source: string;
  /** ISO instant of the last successful sync, or null when it never ran. */
  lastUpdated: string | null;
}

/**
 * THE "Data synced from <source> · Last updated: <date>" line every synced
 * surface shows (the cap table, the financials, the Trust Center). The date is
 * UTC (`formatDate`), so a server-rendered page and its hydrated copy print the
 * same text.
 */
export function DataAttribution({ icon, source, lastUpdated }: DataAttributionProps) {
  return (
    <div className="flex shrink-0 flex-col gap-[var(--spacing-system-xxs)] text-ods-text-primary text-h6 sm:flex-row sm:items-center sm:gap-[var(--spacing-system-sf)]">
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        {icon}
        <span>Data synced from {source}</span>
      </div>
      <span className="hidden text-ods-text-secondary sm:inline" aria-hidden="true">
        &middot;
      </span>
      <span className="text-ods-text-secondary">Last updated: {lastUpdated ? formatDate(lastUpdated) : 'Never'}</span>
    </div>
  );
}
