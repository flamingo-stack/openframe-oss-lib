/**
 * RoadmapGridSkeleton — loading state for the `/roadmap` grid view.
 *
 * Pure JSX (no hooks, no events) — `'use client'` not strictly required
 * here; tsup's client-entry banner injects it automatically when this
 * file is bundled into the client output. We match the playbook's
 * skeleton-file convention (no directive when no hooks).
 *
 * NOTE: lib's `chat/entity-cards/roadmap-card.tsx` also exports a
 * `RoadmapCardSkeleton` — that one is the COMPACT 56px chat-card
 * variant. This file's internal card-skeleton (340px grid card)
 * intentionally stays file-internal to avoid the naming collision;
 * only `RoadmapGridSkeleton` is exported.
 */

function RoadmapCardSkeleton() {
  return (
    <div className="relative flex min-h-[340px] flex-col gap-[16px] rounded-[6px] border border-ods-border bg-ods-card p-[24px]">
      {/* Status Badge Skeleton - Top Right */}
      <div className="absolute right-[24px] top-[24px]">
        <div className="h-[20px] w-[80px] animate-pulse rounded bg-ods-border"></div>
      </div>

      {/* Icon and title skeleton */}
      <div className="flex items-center gap-[16px] pr-[120px]">
        <div className="h-[80px] w-[80px] flex-shrink-0 animate-pulse rounded-lg bg-ods-border"></div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-h-[48px] items-center">
            <div className="h-[24px] w-full animate-pulse rounded bg-ods-border"></div>
          </div>
          <div className="flex min-h-[20px] items-center">
            <div className="h-[14px] w-1/2 animate-pulse rounded bg-ods-border"></div>
          </div>
        </div>
      </div>

      {/* Description skeleton - exactly 3 lines */}
      <div className="flex min-h-[72px] items-center">
        <div className="w-full space-y-2">
          <div className="h-[24px] animate-pulse rounded bg-ods-border"></div>
          <div className="h-[24px] animate-pulse rounded bg-ods-border"></div>
          <div className="h-[24px] w-4/5 animate-pulse rounded bg-ods-border"></div>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Bottom skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-[48px] w-[120px] animate-pulse rounded bg-ods-border"></div>
        <div className="h-[32px] w-[100px] animate-pulse rounded bg-ods-border"></div>
      </div>
    </div>
  );
}

export interface RoadmapGridSkeletonProps {
  /** Number of skeleton cards to show. Default 4. */
  count?: number;
  /** Show the desktop left margin (~120px) that aligns the grid with
   *  the page hero's title block. Default `true`. Related-content rails
   *  inside narrower surfaces (e.g. the release detail page) pass `false`. */
  showLeftMargin?: boolean;
}

export function RoadmapGridSkeleton({ count = 4, showLeftMargin = true }: RoadmapGridSkeletonProps) {
  return (
    <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${showLeftMargin ? 'md:ml-[120px]' : ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <RoadmapCardSkeleton key={i} />
      ))}
    </div>
  );
}
