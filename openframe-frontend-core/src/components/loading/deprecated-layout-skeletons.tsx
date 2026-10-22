import { cn } from '../../utils/cn';
import { CardSkeletonGrid } from './card-skeleton';
import { LoadingRegion } from './loading-region';
import { UnifiedSkeleton } from './unified-skeleton';

interface LoadingLayoutProps {
  className?: string;
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
}

/**
 * @deprecated Draw the blog list itself: its cards draw their own skeletons in a `LoadingScope`. Kept so hosts on an
 * older release keep compiling.
 *
 * Blog Card Grid Skeleton - Always displays exactly 4 blog card skeletons
 * Used for consistent blog page layout with predictable height
 */
// loading-standard-ok: deprecated re-export kept for external consumers
export function BlogCardGridSkeleton({ className, region = true }: LoadingLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <CardSkeletonGrid count={4} variant="blog" region={region} className="grid-cols-1 content-md:grid-cols-2" />
    </div>
  );
}

/**
 * @deprecated The Slack community section is the host's own component, which draws its own skeleton. Kept so hosts
 * on an older release keep compiling.
 *
 * Slack Community Section Skeleton
 * Matches SlackCommunity component structure with title, channel list, and chat interface
 */
// loading-standard-ok: deprecated re-export kept for external consumers
export function SlackCommunitySkeleton({ region = true }: { region?: boolean } = {}) {
  return (
    <LoadingRegion
      label="Loading the Slack community"
      as="section"
      announce={region}
      className="w-full bg-ods-bg px-4 py-12 content-md:px-20 content-md:py-20 content-lg:px-20"
    >
      {/* Frame 651 Container */}
      <div className="flex w-full flex-col gap-4 content-md:gap-6">
        {/* Title Skeleton */}
        <div className="w-full">
          <UnifiedSkeleton className="h-8 max-w-md rounded-lg content-md:h-12 content-lg:h-14" />
        </div>

        {/* Content Area - Channel List + Chat Interface */}
        <div className="flex w-full min-w-0 flex-col gap-4 content-md:gap-6 content-lg:flex-row content-lg:items-start content-lg:justify-end">
          {/* Channel List Skeleton */}
          <div className="flex w-full flex-shrink-0 flex-col overflow-hidden rounded border border-ods-border bg-ods-bg content-lg:w-[290px] content-lg:max-w-[290px]">
            <div className="space-y-4 p-4">
              {/* Header */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <UnifiedSkeleton className="h-4 w-24 rounded" />
                  <UnifiedSkeleton className="h-3 w-16 rounded" />
                </div>
                <UnifiedSkeleton className="h-3 w-32 rounded" />
              </div>

              {/* Channels */}
              <div className="flex flex-col gap-1">
                <UnifiedSkeleton className="mb-2 h-3 w-16 rounded" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex min-h-[48px] items-center gap-2 px-2 py-3">
                    <UnifiedSkeleton className="h-4 w-4 rounded" />
                    <div className="flex-1">
                      <UnifiedSkeleton className="mb-1 h-3 w-24 rounded" />
                      <UnifiedSkeleton className="h-2 w-16 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-2 border-t border-ods-border pt-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <UnifiedSkeleton className="h-3 w-16 rounded" />
                    <UnifiedSkeleton className="h-3 w-8 rounded" />
                  </div>
                  <div className="flex justify-between">
                    <UnifiedSkeleton className="h-3 w-20 rounded" />
                    <UnifiedSkeleton className="h-3 w-8 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Interface Skeleton */}
          <div className="flex h-[450px] min-h-[450px] min-w-0 flex-1 flex-col rounded-lg border border-ods-border bg-ods-card content-md:h-[500px] content-md:min-h-[500px] content-lg:h-[600px] content-lg:min-h-[600px]">
            {/* Header */}
            <div className="flex h-[56px] flex-shrink-0 items-center justify-between border-b border-ods-border bg-ods-bg p-4 content-md:h-[60px] content-md:p-6">
              <div className="flex items-center gap-2">
                <UnifiedSkeleton className="h-3 w-3 rounded content-md:h-4 content-md:w-4" />
                <UnifiedSkeleton className="h-3 w-24 rounded content-md:h-4 content-md:w-32" />
              </div>
              <UnifiedSkeleton className="h-3 w-12 rounded content-md:w-16" />
            </div>

            {/* Messages */}
            <div className="min-h-[280px] flex-1 space-y-3 overflow-hidden bg-ods-bg p-4 content-md:min-h-[320px] content-md:space-y-4 content-md:p-6 content-lg:min-h-[420px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-2 content-md:gap-3">
                  <UnifiedSkeleton className="h-10 w-10 flex-shrink-0 rounded-lg content-md:h-12 content-md:w-12" />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <UnifiedSkeleton className="h-3 w-16 rounded content-md:w-20" />
                      <UnifiedSkeleton className="h-3 w-12 rounded content-md:w-16" />
                    </div>
                    <UnifiedSkeleton className="h-3 w-full rounded content-md:h-4" />
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="h-[72px] flex-shrink-0 border-t border-ods-border bg-ods-card p-4 content-md:h-[80px] content-md:p-6">
              <div className="flex items-end justify-center gap-3 content-md:justify-end">
                <UnifiedSkeleton className="h-10 w-28 rounded-lg content-md:h-12 content-md:w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
