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
    <div className="bg-ods-card border border-ods-border rounded-[6px] p-[24px] flex flex-col gap-[16px] min-h-[340px] relative">
      {/* Status Badge Skeleton - Top Right */}
      <div className="absolute top-[24px] right-[24px]">
        <div className="h-[20px] w-[80px] bg-ods-border rounded animate-pulse"></div>
      </div>

      {/* Icon and title skeleton */}
      <div className="flex items-center gap-[16px] pr-[120px]">
        <div className="w-[80px] h-[80px] bg-ods-border rounded-lg flex-shrink-0 animate-pulse"></div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="min-h-[48px] flex items-center">
            <div className="h-[24px] w-full bg-ods-border rounded animate-pulse"></div>
          </div>
          <div className="min-h-[20px] flex items-center">
            <div className="h-[14px] w-1/2 bg-ods-border rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Description skeleton - exactly 3 lines */}
      <div className="min-h-[72px] flex items-center">
        <div className="w-full space-y-2">
          <div className="h-[24px] bg-ods-border rounded animate-pulse"></div>
          <div className="h-[24px] bg-ods-border rounded animate-pulse"></div>
          <div className="h-[24px] w-4/5 bg-ods-border rounded animate-pulse"></div>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Bottom skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-[48px] w-[120px] bg-ods-border rounded animate-pulse"></div>
        <div className="h-[32px] w-[100px] bg-ods-border rounded animate-pulse"></div>
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
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${showLeftMargin ? 'md:ml-[120px]' : ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <RoadmapCardSkeleton key={i} />
      ))}
    </div>
  );
}
