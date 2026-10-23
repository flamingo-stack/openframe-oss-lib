import type React from 'react';
import { formatEntryMonthUTC } from '../../../utils/format';
import { EmployeeEntryCard, type EmployeeEntryCardData } from './employee-entry-card';

/** Minimal row shape the card renders. Both the hub dashboard entry and the
 *  related-content hydrated row satisfy it structurally. */
export interface WhatIShippedCardData extends EmployeeEntryCardData {
  entry_month?: string | null;
}

interface LoadedWhatIShippedCardProps {
  entry: WhatIShippedCardData;
  /** OG fallback cover. Caller computes it (hub: `useOgPlaceholderUrl`; related
   *  rail: `extras.buildOgPlaceholderUrl`). */
  placeholderUrl?: string | null;
  /** Owner action row (dashboard). Omit for a read-only card. */
  actions?: React.ReactNode;
  /** When provided, the WHOLE card becomes a link (related-rail click-through).
   *  Don't combine with `actions` (nested interactive). */
  anchorProps?: React.AnchorHTMLAttributes<HTMLAnchorElement>;
  className?: string;
}

/** The entry, or `loading` while the host reads it: the card then draws its own loading form (`EmployeeEntryCard`'s). */
export type WhatIShippedCardProps =
  (LoadedWhatIShippedCardProps & { loading?: boolean }) | (Partial<LoadedWhatIShippedCardProps> & { loading: true });

/**
 * THE single "What I Shipped" card — a thin binding over `EmployeeEntryCard`
 * that maps the reporting month to the shared meta date. Used by BOTH the
 * people-hub dashboard (with owner `actions`) and the related-content rail
 * (with `anchorProps` for click-through), so the card is byte-identical
 * everywhere — one engine, one mapping, no drift.
 */
export function WhatIShippedCard(props: WhatIShippedCardProps) {
  if (props.loading) return <EmployeeEntryCard loading actions={props.actions} className={props.className} />;
  const { entry, placeholderUrl, actions, anchorProps, className } = props;
  return (
    <EmployeeEntryCard
      entry={entry}
      dateLabel={formatEntryMonthUTC(entry.entry_month, 'short')}
      placeholderUrl={placeholderUrl}
      actions={actions}
      anchorProps={anchorProps}
      className={className}
    />
  );
}
