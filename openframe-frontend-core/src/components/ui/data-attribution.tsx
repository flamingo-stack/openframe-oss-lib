'use client';

import type { ReactNode } from 'react';
import { DATA_SYNC_SOURCES, type DataSync, type DataSyncSource } from '../../types/data-sync';
import { formatDate } from '../../utils/format';
import { ClickupIcon } from '../icons-v2-generated/brand-logos/clickup-icon';
import { GithubClassicIcon } from '../icons-v2-generated/brand-logos/github-classic-icon';
import { HubspotIcon } from '../icons-v2-generated/brand-logos/hubspot-icon';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

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
const ACTION_CLASS = 'flex content-sm:pl-[var(--spacing-system-xs)]';
const UPDATED_CLASS = 'text-ods-text-secondary';
/** A read word inside the line's own words: a bar of the line's height, on its baseline. */
const WORD_BAR_CLASS = 'inline-block align-bottom';

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
  if (useLoadingScope()) return <DataAttributionSkeleton icon={icon} action={action} />;
  return (
    <div className={LINE_CLASS}>
      <div className={ITEM_CLASS}>
        {icon}
        <span>Data synced from {source}</span>
      </div>
      <Separator />
      <span className={UPDATED_CLASS}>Last updated: {lastUpdated ? formatDate(lastUpdated) : 'Never'}</span>
      {action ? <div className={ACTION_CLASS}>{action}</div> : null}
    </div>
  );
}

/**
 * `DataAttribution` while it is read: the same line (two lines below `content-sm`, one row above it), its own
 * words drawn for real, the source and the date bars of the line's height, so the line does not move when it
 * fills in. The source's mark is the one given (a brand glyph is static), else a box of its size.
 */
export function DataAttributionSkeleton({ icon, action }: Pick<DataAttributionProps, 'icon' | 'action'> = {}) {
  return (
    <div className={LINE_CLASS} aria-hidden="true">
      <div className={ITEM_CLASS}>
        {icon ?? <UnifiedSkeleton className="size-4 rounded" />}
        <span>
          Data synced from <TextLineSkeleton type="inherit" as="span" className={`${WORD_BAR_CLASS} w-20`} />
        </span>
      </div>
      <Separator />
      <span className={UPDATED_CLASS}>
        Last updated: <TextLineSkeleton type="inherit" as="span" className={`${WORD_BAR_CLASS} w-24`} />
      </span>
      {/* The control is the page's own, drawn for real but inert while the line is read. */}
      {action ? (
        <div className={ACTION_CLASS} inert>
          {action}
        </div>
      ) : null}
    </div>
  );
}

/** The mark each sync source is drawn with (the app's standard brand marks); its name is `DATA_SYNC_SOURCES`'. */
const DATA_SYNC_ICONS: Record<DataSyncSource, typeof ClickupIcon> = {
  clickup: ClickupIcon,
  hubspot: HubspotIcon,
  github: GithubClassicIcon,
};

/**
 * THE sync line of a shared page whose records an API reads from a mirror (the roadmap and the delivery board:
 * ClickUp; the ticket center: HubSpot; the docs and the legal documents: GitHub). The page draws whatever `sync`
 * its endpoint answers, so a host that states none shows no line. `loading` draws the line's skeleton, so the page
 * does not move when it fills in. It sits on its own row, at the end; `inline` leaves it in the caller's row.
 */
export function DataSyncLine({
  sync,
  loading: loadingProp = false,
  stated = true,
  inline = false,
  action,
}: {
  sync?: DataSync | null;
  loading?: boolean;
  /**
   * The host states a sync for this page (its source is a mirror). While the sync is read, the line's skeleton is
   * drawn only then: a page whose host states none shows no line, loading or loaded. Default `true`.
   */
  stated?: boolean;
  inline?: boolean;
  action?: ReactNode;
}) {
  // While the sync is read (in a page's loading state, or `loading`), a host that states one holds its line.
  const inScope = useLoadingScope();
  const loading = (loadingProp || inScope) && stated;
  if (!loading && !(sync && sync.source in DATA_SYNC_ICONS)) return null;
  const Icon = sync ? DATA_SYNC_ICONS[sync.source] : null;
  const line =
    loading || !sync || !Icon ? (
      <DataAttributionSkeleton action={action} />
    ) : (
      <DataAttribution
        icon={<Icon size={16} />}
        source={DATA_SYNC_SOURCES[sync.source]}
        lastUpdated={sync.syncedAt}
        action={action}
      />
    );
  return inline ? line : <div className="flex w-full justify-end">{line}</div>;
}
