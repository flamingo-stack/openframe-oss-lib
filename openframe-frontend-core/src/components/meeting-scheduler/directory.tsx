'use client';

/**
 * `<MeetingSchedulerDirectory />` — the embeddable scheduling DIRECTORY
 * block: clickable row cards (host avatars, title/description, For-<audience>
 * chip, next available time, boxed chevron) + the house
 * `PersistentPaginationWrapper`, fed by a host proxy's `GET
 * {apiBaseUrl}/api/meetings` (see `docs/EMBEDDING_HUBSPOT_MEETINGS.md`).
 * Rows navigate to `{bookingBasePath}/{slug}` — pair with
 * `<HubSpotMeetingScheduler>` on that page for the full white-label flow.
 *
 * Layout stability is engineered, not incidental: the rows area reserves one
 * FULL page (pageSize × 80px rows + gaps), the pagination slot holds its
 * measured 72px even when hidden, and the loading state renders same-shell
 * skeleton rows — so nothing below the block ever jumps across
 * loading ⇄ loaded ⇄ page changes ⇄ short last pages.
 *
 * SSR/host mode: pass `initialData` (host-fetched) to skip the client fetch.
 * Client/embed mode: omit it — skeleton page + self-fetch via `contentFetch`
 * (embed-auth adapters inherited for free).
 */

import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Link from '../../embed-shims/next-link';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import type { SchedulingLink, SchedulingLinksPayload } from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import { contentFetch } from '../../utils/embed-content-fetch';
import { formatDurationCompact } from '../../utils/format';
import { EmptyState } from '../empty-state';
import { PersistentPaginationWrapper } from '../persistent-pagination';
import { AvatarStack, StatusBadge, Skeleton } from '../ui';

export interface MeetingSchedulerDirectoryProps {
  /** Endpoints prefix, default '' (same-origin `/api/meetings`). */
  apiBaseUrl?: string;
  /** Host-fetched seed — skips the client fetch when provided. */
  initialData?: SchedulingLinksPayload | null;
  /** `scope=all` — full-portal view (non-conforming links under "other"). */
  includeAll?: boolean;
  /** Rows per page; also the skeleton row count and the reserved rows-area height. */
  pageSize?: number;
  /** Rows link to `${bookingBasePath}/${slug}`. */
  bookingBasePath?: string;
  /** EmptyState CTA target for error/empty states (omit → no CTA). */
  contactHref?: string;
  className?: string;
}

/** Zone-aware "next available" label — resolved POST-mount (SSR renders the
 *  static caption only, so server and client first paint agree). */
function useNextAvailableLabel(ms: number | null): string | null {
  // The label is a pure function of `ms` and the viewer's zone — the ONLY
  // reason it could not be computed during render was that `Intl` resolves a
  // different zone on the server. `useIsHydrated` states that gate directly, so
  // the label is derived rather than stored: no state, and no second render
  // pass per row (this hook runs once per directory row).
  const hydrated = useIsHydrated();
  return useMemo(() => {
    if (!hydrated || ms == null) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(ms));
    } catch {
      return null;
    }
  }, [hydrated, ms]);
}

function DirectoryRow({
  link,
  audienceLabel,
  bookingBasePath,
}: {
  link: SchedulingLink;
  audienceLabel: string;
  bookingBasePath: string;
}) {
  const nextLabel = useNextAvailableLabel(link.nextAvailableMs);

  const subtitle = [
    link.description,
    link.durationsMinutes.length > 0 ? link.durationsMinutes.map(m => formatDurationCompact(m * 60)).join(' / ') : null,
    link.kind === 'team' ? 'Team' : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <Link
      href={`${bookingBasePath}/${link.slug}`}
      prefetch={false}
      className="block rounded-lg text-inherit no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
    >
      <div className="flex min-h-20 w-full items-center gap-4 rounded-lg border border-ods-border bg-ods-card px-4 py-3 transition-colors duration-150 hover:bg-ods-bg-hover">
        {/* Title leads at a fixed X; hosts live in the right meta cluster. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
          <p className="truncate text-ods-text-primary text-h3">{link.title}</p>
          {subtitle && <p className="truncate text-ods-text-secondary text-h6">{subtitle}</p>}
        </div>

        {/* No audience entity (scope=all "other" group) → no chip. */}
        {audienceLabel && (
          <StatusBadge text={`For ${audienceLabel}`} singleLine className="hidden shrink-0 sm:inline-flex" />
        )}

        {/* Hosts stay visible on mobile too — the facepile is the row's "who
            you're booking with" signal; only the chip and next-available meta
            collapse on narrow widths. */}
        <AvatarStack people={link.hosts} max={3} size="md" className="flex shrink-0" />

        <div className="hidden w-44 shrink-0 flex-col items-end justify-center md:flex">
          <p className="text-ods-text-secondary text-h6">Next available</p>
          <p className="min-h-5 text-ods-text-primary text-h6">
            {link.nextAvailableMs == null ? 'No times published' : (nextLabel ?? ' ')}
          </p>
        </div>

        {/* House boxed chevron (ChatTicketItem). */}
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-card">
          <ChevronRight className="size-6 text-ods-text-secondary" />
        </span>
      </div>
    </Link>
  );
}

/** Same-shell loading row (co-located-skeleton convention). */
export function MeetingSchedulerDirectoryRowSkeleton() {
  return (
    <div className="flex min-h-20 w-full items-center gap-4 rounded-lg border border-ods-border bg-ods-card px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="hidden h-6 w-28 shrink-0 sm:block" />
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="hidden w-44 shrink-0 flex-col items-end gap-1 md:flex">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="size-12 shrink-0 rounded-md" />
    </div>
  );
}

/** Measured pagination-slot height (PersistentPaginationWrapper = 72px). */
const PAGINATION_SLOT_H = 'h-[4.5rem]';

export function MeetingSchedulerDirectory({
  apiBaseUrl = '',
  initialData = null,
  includeAll = false,
  pageSize = 6,
  bookingBasePath = '/schedule-a-call',
  contactHref,
  className,
}: MeetingSchedulerDirectoryProps) {
  const [data, setData] = useState<SchedulingLinksPayload | null>(initialData);
  const [isLoading, setIsLoading] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialData !== null) return undefined; // host-seeded — skip the client fetch
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const qs = includeAll ? '?scope=all' : '';
        const res = await contentFetch(`${apiBaseUrl}/api/meetings${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`meetings ${res.status}`);
        const payload = (await res.json()) as SchedulingLinksPayload;
        if (active) setData(payload);
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch scheduling links');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [initialData, includeAll, apiBaseUrl]);

  const rows = useMemo(() => {
    const purposes = data?.purposes ?? [];
    return purposes.flatMap(p => p.links.map(link => ({ link, audienceLabel: p.label })));
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  // Reserved rows-area height: pageSize × 80px rows + (pageSize−1) × 16px gaps.
  const rowsMinHeight = pageSize * 80 + (pageSize - 1) * 16;

  if (isLoading && !data) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className="flex w-full flex-col gap-4" style={{ minHeight: rowsMinHeight }}>
          {Array.from({ length: pageSize }, (_, i) => (
            <MeetingSchedulerDirectoryRowSkeleton key={i} />
          ))}
        </div>
        <div className={cn('mt-8 flex w-full items-center justify-center', PAGINATION_SLOT_H)}>
          <Skeleton className="h-10 w-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col justify-center', className)} style={{ minHeight: rowsMinHeight + 104 }}>
        <EmptyState
          type="generic"
          title="We couldn't load available call times"
          description="Something went wrong on our side. Try again in a minute, or reach us directly."
          {...(contactHref ? { ctaText: 'Contact us', ctaHref: contactHref } : {})}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('flex flex-col justify-center', className)} style={{ minHeight: rowsMinHeight + 104 }}>
        <EmptyState
          type="generic"
          title="No call times are published right now"
          description="We're updating our calendars. Reach us directly and we'll set something up."
          {...(contactHref ? { ctaText: 'Contact us', ctaHref: contactHref } : {})}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex w-full flex-col gap-4" style={{ minHeight: rowsMinHeight }}>
        {pageRows.map(({ link, audienceLabel }) => (
          <DirectoryRow key={link.id} link={link} audienceLabel={audienceLabel} bookingBasePath={bookingBasePath} />
        ))}
      </div>
      {/* House pagination block — dims in place during refetches; the slot
          holds its measured height even at ≤1 page (where the inner
          UnifiedPagination returns null). */}
      <div className={cn('mt-8 flex w-full items-center justify-center', PAGINATION_SLOT_H)}>
        {totalPages > 1 && (
          <PersistentPaginationWrapper
            isLoading={isLoading}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            variant="blog"
          />
        )}
      </div>
    </div>
  );
}
