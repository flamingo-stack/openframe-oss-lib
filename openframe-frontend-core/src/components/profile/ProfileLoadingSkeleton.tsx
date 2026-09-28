import { cn } from '../../utils/cn';

interface ProfileLoadingSkeletonProps {
  className?: string;
}

export function ProfileLoadingSkeleton({ className }: ProfileLoadingSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header skeleton */}
      <div className="flex items-center space-x-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-ods-skeleton" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-ods-skeleton" />
          <div className="h-3 w-24 animate-pulse rounded bg-ods-skeleton" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-4 w-full animate-pulse rounded bg-ods-skeleton" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-ods-skeleton" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-ods-skeleton" />
      </div>
    </div>
  );
}
