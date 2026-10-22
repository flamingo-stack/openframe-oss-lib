'use client';

// The skeleton PARTS a component draws its own loading form from (a component switches itself; nothing here is a
// whole component's or a whole view's skeleton).
export {
  UnifiedSkeleton,
  TextSkeleton,
  TextLineSkeleton,
  MediaSkeleton,
  InteractiveSkeleton,
} from './unified-skeleton';

// New unified loading components
export { ContentLoadingContainer, useContentLoading } from '../content-loading-container';

// Note: OpenmspHeartbeatLoader is a client-only component and should be
// imported directly from "./openmsp-heartbeat" in client components. Do NOT
// export it here, otherwise server components that import this index will
// break due to client-only code.

export { LoadingRegion, type LoadingRegionProps } from './loading-region';
export { LoadingStatus } from '../ui/loading-scope';
export { LoadingFallback, LoadingSuspense } from './loading-fallback';
