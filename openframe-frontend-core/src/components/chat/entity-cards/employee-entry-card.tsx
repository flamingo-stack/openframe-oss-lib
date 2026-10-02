import type React from 'react';
import Image from '../../../embed-shims/next-image';
import { getProxiedImageUrl } from '../../../utils/image-proxy-stub';
import { StatusBadge, type StatusBadgeProps } from '../../ui/status-badge';
import { AdminContentCard } from './admin-content-card';
import { AdminContentCardSkeleton } from './admin-content-card-grid';

/** The fields every people-hub employee entry shares. Entity-specific bindings
 *  (`WhatIShippedCard`, `HowIWorkCard`) map their own date column to `dateLabel`
 *  and pass the rest through unchanged. */
export interface EmployeeEntryCardData {
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  featured_image?: string | null;
  main_video_thumbnail?: string | null;
  author?: { full_name?: string | null; avatar_url?: string | null } | null;
}

export interface EmployeeEntryCardProps {
  entry: EmployeeEntryCardData;
  /** Already-formatted date shown in the meta row. Bindings own the format so
   *  the UTC-pin convention stays in `utils/format`, not in the card. */
  dateLabel?: string | null;
  /** Extra badges rendered after the status badge (e.g. discipline / level). */
  extraBadges?: React.ReactNode;
  /** Fallback title when the entry has none — names the entity in the empty case. */
  untitledLabel?: string;
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

/** Entry lifecycle → the standard badge colour scheme (the same ODS pairs every status badge uses). */
const STATUS_BADGE_SCHEME: Record<string, NonNullable<StatusBadgeProps['colorScheme']>> = {
  published: 'success',
  draft: 'warning',
  archived: 'default',
  // Design-doc lifecycle (product-hub) — same ODS pairs, no new palette.
  in_review: 'warning',
  approved: 'success',
  building: 'success',
  shipped: 'success',
  abandoned: 'default',
};

/** An entity's own badge (discipline, level, step count): the standard `StatusBadge`
 *  stamp, so it sits at exactly the size and height of the status badge beside it. */
export function EmployeeEntryBadge({ children }: { children: string }) {
  return <StatusBadge text={children} colorScheme="default" variant="button" singleLine />;
}

/**
 * THE people-hub employee-entry card. Wraps `AdminContentCard` with the canonical
 * mapping (cover = featured_image || main_video_thumbnail, OG placeholder
 * fallback, title, 140-char summary, status badge, author avatar+name + a date
 * label). Every entity that renders "an employee's entry" binds to this one
 * engine — What I Shipped and How I Work differ only in which date column they
 * format and which extra badges they add, so the card itself cannot drift
 * between the dashboard and the related-content rail.
 */
export function EmployeeEntryCard({
  entry,
  dateLabel,
  extraBadges,
  untitledLabel = 'Untitled entry',
  placeholderUrl,
  actions,
  anchorProps,
  className,
}: EmployeeEntryCardProps) {
  const card = (
    <AdminContentCard
      imageUrl={entry.featured_image || entry.main_video_thumbnail}
      placeholderUrl={placeholderUrl}
      title={entry.title || untitledLabel}
      summary={(entry.summary ?? '').slice(0, 140) || 'No description'}
      badges={
        entry.status || extraBadges ? (
          <>
            {entry.status ? (
              <StatusBadge
                text={entry.status}
                colorScheme={STATUS_BADGE_SCHEME[entry.status] ?? 'default'}
                variant="button"
                singleLine
              />
            ) : null}
            {extraBadges}
          </>
        ) : null
      }
      meta={
        <>
          <span className="flex min-w-0 items-center gap-2">
            {entry.author?.avatar_url ? (
              <Image
                src={getProxiedImageUrl(entry.author.avatar_url) ?? entry.author.avatar_url}
                alt=""
                // One line of the meta row tall (16px on a phone, 20px from md), so the
                // row is exactly the line the skeleton reserves.
                className="h-[1lh] w-[1lh] shrink-0 rounded-full object-cover"
                width={20}
                height={20}
                unoptimized
              />
            ) : null}
            <span className="truncate">{entry.author?.full_name ?? ''}</span>
          </span>
          {dateLabel ? <span>{dateLabel}</span> : null}
        </>
      }
      actions={actions}
      // Every row keeps its space, so every card in a rail or a grid is one
      // height with its rows aligned, and `EmployeeEntryCardSkeleton` (the
      // shared AdminContentCardSkeleton) matches it box for box.
      reserveRows
      // An entry has no subtitle line: nothing to reserve between title and summary.
      subtitleRow={false}
      className={className}
    />
  );
  return anchorProps ? (
    <a {...anchorProps} className="block h-full">
      {card}
    </a>
  ) : (
    card
  );
}

/**
 * The employee-entry card's placeholder: THE admin card skeleton, the same
 * component every `AdminContentCard reserveRows` grid uses, so the loading card
 * and the real one are the same box. `actions` matches a card rendered with an
 * owner action row (the dashboards); a read-only card (rails) has none.
 */
export function EmployeeEntryCardSkeleton({ className, actions = false }: { className?: string; actions?: boolean }) {
  return <AdminContentCardSkeleton className={className} actions={actions} subtitleRow={false} />;
}
