import { RoadmapCardSkeleton } from '../../chat/entity-cards/roadmap-card';
import { LoadingRegion } from '../../loading/loading-region';
/**
 * RoadmapGridSkeleton: loading state for the `/roadmap` grid view. The grid
 * renders `RoadmapCard`, so each placeholder is that card's own loading box,
 * `RoadmapCardSkeleton`.
 */

export interface RoadmapGridSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  /** Number of skeleton cards to show. Default 4. */
  count?: number;
  /** Show the desktop left margin (~120px) that aligns the grid with
   *  the page hero's title block. Default `true`. Related-content rails
   *  inside narrower surfaces (e.g. the release detail page) pass `false`. */
  showLeftMargin?: boolean;
}

export function RoadmapGridSkeleton({ region = true, count = 4, showLeftMargin = true }: RoadmapGridSkeletonProps) {
  return (
    <LoadingRegion
      label="Loading the roadmap"
      announce={region}
      className={`grid grid-cols-1 gap-6 content-md:grid-cols-2 ${showLeftMargin ? 'content-md:ml-[120px]' : ''}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <RoadmapCardSkeleton key={i} />
      ))}
    </LoadingRegion>
  );
}
