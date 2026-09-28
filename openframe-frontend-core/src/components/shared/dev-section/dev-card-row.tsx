'use client';

/**
 * Shared row chrome for any `DevSectionPage` list (delivery, tickets,
 * future sections). One source of truth for the layout that every
 * dev-section card row uses:
 *   left column  → title (h3) / subtitle (h5 uppercase) / description
 *                  (h4 line-clamp-3), each in a fixed min-height block
 *                  so rows align across the grid
 *   right column → caller-supplied stacked badges
 *
 * Surface stays small on purpose — `rightBadges` is a `ReactNode` so
 * the caller decides how many badges (delivery: 2, tickets: 1-2,
 * future: anything). No behavior baked in: the caller wraps the row
 * in a `<div>` (static, like delivery) or `<button>` (clickable, like
 * tickets) and renders the row content via this component.
 *
 * Pair with `DevCardRowSkeletonList` for the loading state — the
 * skeleton mirrors the same min-heights so the in-flight UI doesn't
 * shift the layout when real data lands.
 *
 * NOTE: the ticket conversation row is NOT here — it renders the shared
 * `<ChatMessageRow>` (`components/chat/chat-message-row.tsx`), the SAME
 * component the OpenMSP Slack-community feed uses, so the two surfaces stay
 * pixel-identical by construction.
 */

import type { ReactNode } from 'react';

export interface DevCardRowContentProps {
  title: string;
  /** Single-line uppercase metadata (e.g. "UPDATED today, #4271, Code review"). */
  subtitle: string;
  /** 3-line description block. Empty string renders the fallback. */
  description: string;
  /** Fallback copy when `description` is empty. Defaults to a generic
   *  string; ticket / delivery surfaces override. */
  emptyDescription?: string;
  /** Right column — caller renders its own stacked badges. */
  rightBadges: ReactNode;
}

export function DevCardRowContent({
  title,
  subtitle,
  description,
  emptyDescription = 'No description provided',
  rightBadges,
}: DevCardRowContentProps) {
  return (
    <div className="flex w-full flex-col items-start justify-between gap-[12px] md:flex-row md:gap-[16px]">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-[12px] md:w-auto md:gap-[16px]">
        <div className="flex min-h-[24px] items-center">
          <h3 className="line-clamp-2 flex-1 break-words tracking-[-0.36px] text-ods-text-primary text-h3 md:truncate">
            {title}
          </h3>
        </div>
        <div className="flex min-h-[20px] items-center">
          <p className="truncate uppercase tracking-[-0.28px] text-ods-text-secondary text-h5">{subtitle}</p>
        </div>
        <div className="flex min-h-[72px] items-center">
          <p className="line-clamp-3 break-words text-ods-text-secondary text-h4">{description || emptyDescription}</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col gap-2 self-start">{rightBadges}</div>
    </div>
  );
}

/**
 * Skeleton rendering for a single row — the bars mirror the same
 * min-heights as `DevCardRowContent` so the loading→loaded swap
 * doesn't reflow.
 */
export function DevCardRowSkeleton() {
  return (
    <div className="border-b border-ods-border p-[12px] last:border-b-0 md:p-[16px]">
      <div className="flex w-full flex-col items-start justify-between gap-[12px] md:flex-row md:gap-[16px]">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-[12px] md:w-auto md:gap-[16px]">
          <div className="flex min-h-[24px] items-center">
            <div className="h-[20px] w-full animate-pulse rounded bg-ods-border" />
          </div>
          <div className="flex min-h-[20px] items-center">
            <div className="h-[20px] w-1/2 animate-pulse rounded bg-ods-border" />
          </div>
          <div className="flex min-h-[72px] items-center">
            <div className="flex-1 space-y-1">
              <div className="h-[20px] w-full animate-pulse rounded bg-ods-border" />
              <div className="h-[20px] w-full animate-pulse rounded bg-ods-border" />
              <div className="h-[20px] w-2/3 animate-pulse rounded bg-ods-border" />
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col gap-2 self-start">
          <div className="h-[32px] w-[100px] animate-pulse rounded bg-ods-border" />
          <div className="h-[32px] w-[120px] animate-pulse rounded bg-ods-border" />
        </div>
      </div>
    </div>
  );
}

/**
 * The standard "5 skeleton rows inside a bordered card" loading state
 * used by every list shell. Both delivery (`delivery-table.tsx`) and
 * tickets (`tickets-list.tsx`) mount this directly.
 */
export function DevCardRowSkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      {Array.from({ length: rows }, (_, i) => (
        <DevCardRowSkeleton key={i} />
      ))}
    </div>
  );
}
