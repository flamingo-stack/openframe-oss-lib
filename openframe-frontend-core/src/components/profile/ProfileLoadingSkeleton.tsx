import { cn } from '../../utils/cn';
import { UnifiedSkeleton } from '../loading/unified-skeleton';

interface ProfileLoadingSkeletonProps {
  className?: string;
}

export function ProfileLoadingSkeleton({ className }: ProfileLoadingSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
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
    </div>
  );
}
