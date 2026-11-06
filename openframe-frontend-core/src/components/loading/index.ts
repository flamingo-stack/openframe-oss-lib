'use client';

// The skeleton PARTS a component draws its own loading form from (a component switches itself; nothing here is a
// whole component's or a whole view's skeleton).
export {
  UnifiedSkeleton,
  TextSkeleton,
  TextLineSkeleton,
  TextLinesByBreakpointSkeleton,
  type TextLinesByBreakpoint,
  MediaSkeleton,
  InteractiveSkeleton,
} from './unified-skeleton';

// New unified loading components
export { ContentLoadingContainer, useContentLoading } from '../content-loading-container';

export { LoadingRegion, type LoadingRegionProps } from './loading-region';
export { LoadingStatus } from '../ui/loading-scope';
export { LoadingFallback, LoadingSuspense } from './loading-fallback';
