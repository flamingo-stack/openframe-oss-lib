import type { ReactNode } from 'react';
import type { DataSync } from '../../types/data-sync';
import { formatDate } from '../../utils/format';
import { ClickupIcon } from '../icons-v2-generated/brand-logos/clickup-icon';
import { GithubClassicIcon } from '../icons-v2-generated/brand-logos/github-classic-icon';
import { HubspotIcon } from '../icons-v2-generated/brand-logos/hubspot-icon';
import { TextSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';

export interface DataAttributionProps {
  /** The source's mark, sized by the caller (e.g. `<CartaIcon className="h-4 w-4" />`). */
  icon?: ReactNode;
  /** The system the data is read from ("Carta", "QuickBooks", "Vanta"). */
  source: string;
  /** ISO instant of the last successful sync, or null when it never ran. */
  lastUpdated: string | null;
  /** One control at the end of the line: a way to take this data away (a `DownloadButton` for a file of it). */
  action?: ReactNode;
}

const LINE_CLASS =
  'flex shrink-0 flex-col gap-[var(--spacing-system-xsf)] text-ods-text-primary text-h6 content-sm:flex-row content-sm:items-center content-sm:gap-[var(--spacing-system-sf)]';
const ITEM_CLASS = 'flex items-center gap-[var(--spacing-system-xsf)]';

function Separator() {
  return (
    <span className="hidden text-ods-text-secondary content-sm:inline" aria-hidden="true">
      &middot;
    </span>
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
      {action ? <div className="flex content-sm:pl-[var(--spacing-system-xs)]">{action}</div> : null}
    </div>
  );
}

/**
 * `DataAttribution` while its date loads: the same line (two lines below
 * `content-sm`, one row above it) with text bars, so the line does not move
 * when it fills in.
 */
export function DataAttributionSkeleton() {
  return (
    <div className={LINE_CLASS} aria-hidden="true">
      <div className={ITEM_CLASS}>
        <UnifiedSkeleton className="size-4 rounded" />
        <TextSkeleton.Body className="w-40" />
      </div>
      <TextSkeleton.Body className="w-52" />
    </div>
  );
}

/** The systems a shared page's records are mirrored from, by the `source` an API states in its `sync`, each with the
 *  mark the rest of the app draws for it (`ClickupIcon`, `HubspotIcon`, `GithubClassicIcon`). */
const DATA_SYNC_SOURCES = {
  clickup: { name: 'ClickUp', Icon: ClickupIcon },
  hubspot: { name: 'HubSpot', Icon: HubspotIcon },
  github: { name: 'GitHub', Icon: GithubClassicIcon },
} as const;

/**
 * THE sync line of a shared page whose records an API reads from a mirror (the roadmap and the delivery board:
 * ClickUp; the ticket center: HubSpot; the docs and the legal documents: GitHub). The page draws whatever `sync`
 * its endpoint answers, so a host that states none shows no line. `loading` draws the line's skeleton, so the page
 * does not move when it fills in. It sits on its own row, at the end; `inline` leaves it in the caller's row.
 */
export function DataSyncLine({
  sync,
  loading = false,
  inline = false,
  action,
}: {
  sync?: DataSync | null;
  loading?: boolean;
  inline?: boolean;
  action?: ReactNode;
}) {
  if (!loading && !sync) return null;
  const known = sync ? DATA_SYNC_SOURCES[sync.source as keyof typeof DATA_SYNC_SOURCES] : undefined;
  const line =
    loading || !sync ? (
      <DataAttributionSkeleton />
    ) : (
      <DataAttribution
        icon={known ? <known.Icon size={16} /> : undefined}
        source={known?.name ?? sync.source}
        lastUpdated={sync.syncedAt}
        action={action}
      />
    );
  return inline ? line : <div className="flex w-full justify-end">{line}</div>;
}
