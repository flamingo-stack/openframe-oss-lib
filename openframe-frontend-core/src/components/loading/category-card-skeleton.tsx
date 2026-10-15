import { cn } from '../../utils/cn';
import { UnifiedSkeleton, TextSkeleton } from './unified-skeleton';

interface CategoryCardSkeletonProps {
  className?: string;
}

export function CategoryCardSkeleton({ className }: CategoryCardSkeletonProps) {
  return (
    <article
      className={cn(
        'box-border flex min-w-0 flex-col rounded-[12px] border border-ods-border bg-ods-card p-8',
        className,
      )}
    >
      {/* Icons row */}
      <div className="mb-8 flex items-center justify-center gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <UnifiedSkeleton key={i} variant="circular" className="h-10 w-10 flex-shrink-0" />
        ))}
      </div>

      {/* Text block */}
      <div className="flex flex-1 flex-col space-y-3">
        <TextSkeleton.Heading className="w-3/4" />
        <TextSkeleton.Body className="w-1/2" />
        <TextSkeleton.Body className="w-full" />
      </div>

      {/* Arrow button placeholder */}
      <div className="mt-4 flex justify-end">
        <UnifiedSkeleton className="h-12 w-12 rounded-[6px]" />
      </div>
    </article>
  );
}
