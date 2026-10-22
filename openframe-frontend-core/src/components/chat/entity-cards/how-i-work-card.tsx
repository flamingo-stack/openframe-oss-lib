import type React from 'react';
import { formatDateUTC } from '../../../utils/format';
import {
  EmployeeEntryCard,
  EmployeeEntryBadge,
  type EmployeeEntryCardData,
} from './employee-entry-card';

/** Minimal row shape the card renders. Both the hub dashboard entry and the
 *  related-content hydrated row satisfy it structurally. */
export interface HowIWorkCardData extends EmployeeEntryCardData {
  session_date?: string | null;
  /** Which craft the session is about — surfaced as a badge so a reader
   *  scanning the grid can tell a sales workflow from an engineering one. */
  discipline?: string | null;
}

interface LoadedHowIWorkCardProps {
  entry: HowIWorkCardData;
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
export type HowIWorkCardProps = (LoadedHowIWorkCardProps & { loading?: boolean }) | (Partial<LoadedHowIWorkCardProps> & { loading: true });

/** `ops` is an initialism, so the generic capitalize would render it "Ops" —
 *  fine — but `session_date`-style multiword disciplines need the underscore
 *  stripped too. One place, so the badge matches the filter chip exactly. */
function disciplineLabel(discipline: string): string {
  return discipline.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

/**
 * THE single "How I Work" card — a thin binding over `EmployeeEntryCard` that
 * maps the session date to the shared meta date and adds the discipline badge.
 * Used by BOTH the people-hub dashboard (with owner `actions`) and the
 * related-content rail (with `anchorProps`), so the card cannot drift between
 * the two surfaces.
 */
export function HowIWorkCard(props: HowIWorkCardProps) {
  if (props.loading) return <EmployeeEntryCard loading actions={props.actions} className={props.className} />;
  const { entry, placeholderUrl, actions, anchorProps, className } = props;
  return (
    <EmployeeEntryCard
      entry={entry}
      // `formatDateUTC` anchors date-only strings to UTC midnight, which is what
      // keeps the label from shifting a day between server and client render.
      dateLabel={entry.session_date ? formatDateUTC(entry.session_date, { fallback: '' }) || null : null}
      extraBadges={
        entry.discipline ? <EmployeeEntryBadge>{disciplineLabel(entry.discipline)}</EmployeeEntryBadge> : null
      }
      untitledLabel="Untitled session"
      placeholderUrl={placeholderUrl}
      actions={actions}
      anchorProps={anchorProps}
      className={className}
    />
  );
}

