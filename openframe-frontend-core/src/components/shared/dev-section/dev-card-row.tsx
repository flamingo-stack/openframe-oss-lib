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
    <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
      <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
        <div className="min-h-[24px] flex items-center">
          <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] flex-1 line-clamp-2 md:truncate break-words">
            {title}
          </h3>
        </div>
        <div className="min-h-[20px] flex items-center">
          <p className="text-h5 text-ods-text-secondary uppercase tracking-[-0.28px] truncate">
            {subtitle}
          </p>
        </div>
        <div className="min-h-[72px] flex items-center">
          <p className="text-h4 text-ods-text-secondary line-clamp-3 break-words">
            {description || emptyDescription}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 self-start flex flex-col gap-2">
        {rightBadges}
      </div>
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
    <div className="border-b border-ods-border last:border-b-0 p-[12px] md:p-[16px]">
      <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
        <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
          <div className="min-h-[24px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-full" />
          </div>
          <div className="min-h-[20px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-1/2" />
          </div>
          <div className="min-h-[72px] flex items-center">
            <div className="flex-1 space-y-1">
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full" />
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full" />
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-2/3" />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 self-start flex flex-col gap-2">
          <div className="h-[32px] w-[100px] bg-ods-border rounded animate-pulse" />
          <div className="h-[32px] w-[120px] bg-ods-border rounded animate-pulse" />
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
    <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
      {Array.from({ length: rows }, (_, i) => (
        <DevCardRowSkeleton key={i} />
      ))}
    </div>
  );
}
