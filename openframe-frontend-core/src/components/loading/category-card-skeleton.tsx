'use client';

import { cn } from '../../utils/cn';
import { LoadingItems } from '../ui/loading-scope';
import { UnifiedSkeleton, TextSkeleton } from './unified-skeleton';

interface CategoryCardSkeletonProps {
  className?: string;
}

/** Vendor icons the loading card's icon row draws: the row the loaded card shows. */
const CATEGORY_CARD_SKELETON_ICONS = 10;

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
        <LoadingItems count={CATEGORY_CARD_SKELETON_ICONS}>
          {() => <UnifiedSkeleton data-loading-item variant="circular" className="h-10 w-10 flex-shrink-0" />}
        </LoadingItems>
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
