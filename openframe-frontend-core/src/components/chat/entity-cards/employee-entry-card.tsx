import type React from 'react';
import Image from '../../../embed-shims/next-image';
import { getProxiedImageUrl } from '../../../utils/image-proxy-stub';
import { AdminContentCard } from './admin-content-card';

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

const STATUS_BADGE_CLASS: Record<string, string> = {
  published: 'bg-ods-success-secondary text-ods-success',
  draft: 'bg-ods-warning-secondary text-ods-warning',
  archived: 'bg-ods-border text-ods-text-secondary',
  // Design-doc lifecycle (product-hub) — same ODS pairs, no new palette.
  in_review: 'bg-ods-warning-secondary text-ods-warning',
  approved: 'bg-ods-success-secondary text-ods-success',
  building: 'bg-ods-success-secondary text-ods-success',
  shipped: 'bg-ods-success-secondary text-ods-success',
  abandoned: 'bg-ods-border text-ods-text-secondary',
};

/** Shared badge treatment so an entity's own badges (discipline, level) sit
 *  flush with the status badge instead of re-deriving the classes per card. */
export function EmployeeEntryBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-ods-border bg-ods-card px-2 py-1 text-xs font-medium text-ods-text-secondary">
      {children}
    </span>
  );
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
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  STATUS_BADGE_CLASS[entry.status] ?? 'border border-ods-border bg-ods-card text-ods-text-secondary'
                }`}
              >
                {entry.status}
              </span>
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
                className="h-5 w-5 shrink-0 rounded-full object-cover"
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

/** Loading skeleton matching EmployeeEntryCard's AdminContentCard shape (3:2 cover
 *  + title / summary / meta lines). Used by the related-content rail while a
 *  group hydrates so there's no shape jump when the real card lands. */
export function EmployeeEntryCardSkeleton({ className }: { className?: string }) {
  // Same convention as BlogCardSkeleton et al.: animate-pulse on the container,
  // `bg-ods-bg` placeholder blocks, flex-grow body with an `mt-auto` avatar+name
  // row. Shape mirrors EmployeeEntryCard's AdminContentCard (rounded-2xl, 3:2 cover).
  return (
    <div
      className={`group flex h-full animate-pulse flex-col overflow-hidden rounded-2xl border border-ods-border bg-ods-card ${className ?? ''}`}
    >
      <div className="aspect-[3/2] bg-ods-bg" />
      <div className="flex flex-grow flex-col space-y-3 p-4">
        <div className="h-5 w-3/4 rounded bg-ods-bg" />
        <div className="h-3 w-full rounded bg-ods-bg/60" />
        <div className="h-3 w-4/5 rounded bg-ods-bg/60" />
        <div className="mt-auto flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-ods-bg" />
          <div className="h-3 w-24 rounded bg-ods-bg/60" />
        </div>
      </div>
    </div>
  );
}
