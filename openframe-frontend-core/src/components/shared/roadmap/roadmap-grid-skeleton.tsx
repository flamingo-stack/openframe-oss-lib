import { RoadmapCardSkeleton } from '../../chat/entity-cards/roadmap-card';
import { LoadingRegion } from '../../loading/loading-region';
/**
 * RoadmapGridSkeleton: loading state for the `/roadmap` grid view. The grid
 * renders `RoadmapCard`, so each placeholder is that card's own loading box,
 * `RoadmapCardSkeleton`.
 */

/**
 * The grid's box, read by `RoadmapGrid` and by its skeleton: one column, two from `content-md` when `columns` is 2,
 * and the desktop left margin that aligns it with the page hero's title. LITERAL class strings: an interpolated
 * `content-md:grid-cols-${n}` is invisible to Tailwind's scanner and is never generated.
 */
export function roadmapGridClass(columns: 1 | 2, showLeftMargin: boolean): string {
  return `grid grid-cols-1 gap-6 ${columns === 2 ? 'content-md:grid-cols-2' : ''} ${
    showLeftMargin ? 'content-md:ml-[120px]' : ''
  }`;
}

/**
 * Cards the grid's skeleton draws when its host states no count: a typical count. The roadmap lists every item it
 * holds (no page, no limit); a host that reads a known number of items passes it as `count`.
 */
export const ROADMAP_GRID_SKELETON_CARDS = 4;

export interface RoadmapGridSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  /** Skeleton cards: the number of items the host reads. Default `ROADMAP_GRID_SKELETON_CARDS`, a typical count. */
  count?: number;
  /** Show the desktop left margin (~120px) that aligns the grid with
   *  the page hero's title block. Default `true`. Related-content rails
   *  inside narrower surfaces (e.g. the release detail page) pass `false`. */
  showLeftMargin?: boolean;
  /** The grid's columns from `content-md` (`RoadmapGrid`'s `columns`). Default `2`. */
  columns?: 1 | 2;
}

export function RoadmapGridSkeleton({
  region = true,
  count = ROADMAP_GRID_SKELETON_CARDS,
  showLeftMargin = true,
  columns = 2,
}: RoadmapGridSkeletonProps) {
  return (
    <LoadingRegion label="Loading the roadmap" announce={region} className={roadmapGridClass(columns, showLeftMargin)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="min-w-0" data-loading-item>
          <RoadmapCardSkeleton />
        </div>
      ))}
    </LoadingRegion>
  );
}
