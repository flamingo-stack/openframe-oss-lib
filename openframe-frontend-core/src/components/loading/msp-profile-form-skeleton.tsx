import { cn } from '../../utils/cn';
import { LoadingRegion } from './loading-region';
import { UnifiedSkeleton, TextSkeleton, InteractiveSkeleton } from './unified-skeleton';

interface SkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  className?: string;
  /**
   * Number of input fields to render on the right column (defaults to 4).
   */
  fields?: number;
}

/**
 * MspProfileFormSkeleton
 * -----------------------------------------------------------------------------
 * Loading state for the <MspProfileForm /> component used in the Share-Your-Stack
 * wizard (and any other area that re-uses the form).
 *
 * Design Notes:
 * – Two-column grid matching the live component (logo upload on the left,
 *   text / numeric inputs on the right).
 * – Left column: square/circular media skeleton to represent logo uploader.
 * – Right column: label + input pair per field.
 * – Mobile (<768px) collapses to one column via grid existing classes.
 * – Uses UnifiedSkeleton system to stay consistent with global loading design.
 *
 * @deprecated Render the form itself inside a `LoadingScope`: its fields draw their own skeletons. Kept so hosts on an older release keep compiling; nothing in the lib uses it.
 */
// loading-standard-ok: deprecated re-export kept for external consumers
export function MspProfileFormSkeleton({ region = true, className, fields = 4 }: SkeletonProps) {
  return (
    <LoadingRegion
      label="Loading the MSP profile"
      announce={region}
      className={cn('grid grid-cols-1 items-stretch gap-6 content-md:grid-cols-2', className)}
    >
      {/* Left – Logo uploader placeholder */}
      <div className="flex h-full flex-col space-y-2">
        {/* Label skeleton */}
        <TextSkeleton.Body className="w-28" />
        <div className="min-h-[180px] flex-1 content-md:min-h-full">
          <UnifiedSkeleton className="h-full w-full rounded-lg" />
        </div>
      </div>

      {/* Right – Input fields grid (mirrors form) */}
      <div className="grid grid-cols-1 gap-4 content-md:grid-cols-2">
        {Array.from({ length: fields }).map((_, idx) => (
          <div key={idx} className="flex flex-col space-y-2">
            <TextSkeleton.Body className="w-40" />
            <InteractiveSkeleton.Input />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
