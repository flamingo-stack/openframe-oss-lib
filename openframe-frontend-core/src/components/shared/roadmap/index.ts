/**
 * Shared roadmap surface barrel.
 *
 * IMPORTANT: This barrel MUST NOT re-export `RoadmapItem`. The canonical
 * type is exported via two paths already:
 *   - `@flamingo-stack/openframe-frontend-core/components/chat`
 *     (the source of truth at `chat/types/entities/roadmap-item.ts`)
 *   - `@flamingo-stack/openframe-frontend-core/components` (via
 *     `./shared/product-release` re-export)
 *
 * Adding a third re-export path here would trigger TypeScript's TS2308
 * ambiguous re-export warning. Consumers needing the type should import
 * it from one of the two existing paths.
 */

export { RoadmapGrid, type RoadmapGridProps } from './roadmap-grid';
export { RoadmapGridSkeleton, type RoadmapGridSkeletonProps } from './roadmap-grid-skeleton';
// `VoteType` deliberately NOT re-exported — `./chat` already exports
// the same-shape `VoteType` from `roadmap-card.tsx`; a duplicate path
// triggers TS2308 ambiguous re-export at the top-level
// `components/index.ts` barrel. Consumers can import the canonical
// `VoteType` from `@flamingo-stack/openframe-frontend-core/components/chat`.
export { useRoadmapVoting, type VoteState, type UseRoadmapVotingOptions } from './use-roadmap-voting';
