import { cn } from '../../utils/cn';
import { LoadingRegion } from '../loading/loading-region';
import { UnifiedSkeleton } from '../loading/unified-skeleton';

interface ProfileLoadingSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  className?: string;
}

export function ProfileLoadingSkeleton({ region = true, className }: ProfileLoadingSkeletonProps) {
  return (
    <LoadingRegion label="Loading the profile" announce={region} className={cn('space-y-6', className)}>
      {/* Header skeleton */}
      <div className="flex items-center space-x-4">
        <UnifiedSkeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <UnifiedSkeleton className="h-4 w-32 rounded" />
          <UnifiedSkeleton className="h-3 w-24 rounded" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <UnifiedSkeleton className="h-4 w-full rounded" />
        <UnifiedSkeleton className="h-4 w-3/4 rounded" />
        <UnifiedSkeleton className="h-4 w-1/2 rounded" />
      </div>
    </LoadingRegion>
  );
}
