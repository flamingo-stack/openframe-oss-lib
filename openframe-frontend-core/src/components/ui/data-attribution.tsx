import type { ReactNode } from 'react';
import { formatDate } from '../../utils/format';

export interface DataAttributionAction {
  label: string;
  href: string;
  /** A 16px glyph before the label (e.g. `<Download01Icon className="size-4" />`). */
  icon?: ReactNode;
}

export interface DataAttributionProps {
  /** The source's mark, sized by the caller (e.g. `<CartaIcon className="h-4 w-4" />`). */
  icon?: ReactNode;
  /** The system the data is read from ("Carta", "QuickBooks", "Vanta"). */
  source: string;
  /** ISO instant of the last successful sync, or null when it never ran. */
  lastUpdated: string | null;
  /** One quiet link at the end of the line: a way to take this data away (a file of it). */
  action?: DataAttributionAction;
}

const LINE_CLASS =
  'flex shrink-0 flex-col gap-[var(--spacing-system-xxs)] text-ods-text-primary text-h6 content-sm:flex-row content-sm:items-center content-sm:gap-[var(--spacing-system-sf)]';
const ITEM_CLASS = 'flex items-center gap-[var(--spacing-system-xsf)]';

function Separator() {
  return (
    <span className="hidden text-ods-text-secondary content-sm:inline" aria-hidden="true">
      &middot;
    </span>
  );
}

/**
 * The line's link, in the line's own type: secondary text, underlined, never
 * louder than the facts beside it. Opens in a new tab (a file downloads there
 * without leaving the page). Exported for a surface that shows the link while
 * it has no source to attribute yet.
 */
export function DataAttributionLink({ label, href, icon }: DataAttributionAction) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${ITEM_CLASS} text-ods-text-secondary underline underline-offset-2 transition-colors text-h6 hover:text-ods-text-primary`}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

/**
 * THE "Data synced from <source> · Last updated: <date>" line every synced
 * surface shows (the cap table, the financials, the Trust Center). The date is
 * UTC (`formatDate`), so a server-rendered page and its hydrated copy print the
 * same text.
 */
export function DataAttribution({ icon, source, lastUpdated, action }: DataAttributionProps) {
  return (
    <div className={LINE_CLASS}>
      <div className={ITEM_CLASS}>
        {icon}
        <span>Data synced from {source}</span>
      </div>
      <Separator />
      <span className="text-ods-text-secondary">Last updated: {lastUpdated ? formatDate(lastUpdated) : 'Never'}</span>
      {action ? (
        <>
          <Separator />
          <DataAttributionLink {...action} />
        </>
      ) : null}
    </div>
  );
}
