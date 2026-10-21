'use client';

import { cn } from '../../utils/cn';
import { LoadingItems } from '../ui/loading-scope';
import { UnifiedSkeleton, TextSkeleton } from './unified-skeleton';

interface CategoryCardSkeletonProps {
  className?: string;
}

/** Vendor icons a typical card shows: the loading card draws that many, and a card given no icons that many empty tiles. */
export const CATEGORY_CARD_SKELETON_ICONS = 10;
/** The card's boxes, read by `CategoryCard` and by this skeleton, so both are one box. */
export const CATEGORY_CARD_FRAME_CLASS =
  'box-border flex min-w-0 flex-col rounded-[12px] border border-ods-border bg-ods-card p-8';
export const CATEGORY_CARD_ICON_ROW_CLASS = 'mb-8 flex items-center justify-center gap-6';
export const CATEGORY_CARD_ICON_TILE_CLASS = 'h-10 w-10 flex-shrink-0';
export const CATEGORY_CARD_ACTION_BOX_CLASS = 'h-12 w-12 rounded-[6px]';

export function CategoryCardSkeleton({ className }: CategoryCardSkeletonProps) {
  return (
    <article className={cn(CATEGORY_CARD_FRAME_CLASS, className)}>
      {/* Icons row */}
      <div className={CATEGORY_CARD_ICON_ROW_CLASS}>
        <LoadingItems count={CATEGORY_CARD_SKELETON_ICONS}>
          {() => <UnifiedSkeleton data-loading-item variant="circular" className={CATEGORY_CARD_ICON_TILE_CLASS} />}
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
        <UnifiedSkeleton className={CATEGORY_CARD_ACTION_BOX_CLASS} />
      </div>
    </article>
  );
}
