import type React from 'react';
import { formatDateUTC } from '../../../utils/format';
import {
  EmployeeEntryBadge,
  EmployeeEntryCard,
  type EmployeeEntryCardData,
  EmployeeEntryCardSkeleton,
} from './employee-entry-card';

/** Minimal row shape the card renders. Both the hub dashboard entry and the
 *  related-content hydrated row satisfy it structurally. */
export interface AiPromptCardData extends EmployeeEntryCardData {
  published_at?: string | null;
  /** The department the prompt is for, surfaced as a badge (the library's filter axis). */
  department?: { name?: string | null } | null;
  /** How many steps the prompt has. A chain (more than one) is badged. */
  step_count?: number | null;
}

export interface AiPromptCardProps {
  entry: AiPromptCardData;
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

/**
 * THE single Squawkbox prompt card: a thin binding over `EmployeeEntryCard`
 * that maps the publish date to the meta date and adds the department and step
 * count badges. Used by the people-hub dashboard (with owner `actions`) and the
 * related-content rail (with `anchorProps`), so the card cannot drift between them.
 */
export function AiPromptCard({ entry, placeholderUrl, actions, anchorProps, className }: AiPromptCardProps) {
  const department = entry.department?.name?.trim();
  const steps = typeof entry.step_count === 'number' ? entry.step_count : 0;
  return (
    <EmployeeEntryCard
      entry={entry}
      dateLabel={entry.published_at ? formatDateUTC(entry.published_at, { fallback: '' }) || null : null}
      extraBadges={
        <>
          {department ? <EmployeeEntryBadge>{department}</EmployeeEntryBadge> : null}
          {steps > 1 ? <EmployeeEntryBadge>{`${steps} steps`}</EmployeeEntryBadge> : null}
        </>
      }
      untitledLabel="Untitled prompt"
      placeholderUrl={placeholderUrl}
      actions={actions}
      anchorProps={anchorProps}
      className={className}
    />
  );
}

/** Loading skeleton matching AiPromptCard's shape (the shared employee-entry skeleton). */
export const AiPromptCardSkeleton = EmployeeEntryCardSkeleton;
