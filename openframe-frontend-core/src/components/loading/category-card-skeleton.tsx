'use client';

import { cn } from '../../utils/cn';
import { LoadingItems } from '../ui/loading-scope';
import { TextLineSkeleton, UnifiedSkeleton } from './unified-skeleton';

interface CategoryCardSkeletonProps {
  className?: string;
}

/** Vendor icons a typical card shows: the loading card draws that many. */
export const CATEGORY_CARD_SKELETON_ICONS = 10;
/** The card's boxes, read by `CategoryCard` and by this skeleton, so both are one box. */
export const CATEGORY_CARD_FRAME_CLASS =
  'box-border flex min-w-0 flex-col rounded-[12px] border border-ods-border bg-ods-card p-8';
/** The icon row keeps one tile's height with no icons, so a card given none is the loading card's height. */
export const CATEGORY_CARD_ICON_ROW_CLASS = 'mb-8 flex min-h-10 items-center justify-center gap-6';
export const CATEGORY_CARD_ICON_TILE_CLASS = 'h-10 w-10 flex-shrink-0';
export const CATEGORY_CARD_TEXT_BLOCK_CLASS = 'flex flex-1 flex-col';
export const CATEGORY_CARD_TITLE_CLASS = 'mb-2 text-left text-ods-text-primary text-h2';
export const CATEGORY_CARD_COUNTS_CLASS = 'mb-4 text-left text-ods-text-secondary text-h6';
export const CATEGORY_CARD_DESCRIPTION_ROW_CLASS = 'flex flex-row items-start';
export const CATEGORY_CARD_DESCRIPTION_CLASS = 'flex-1 text-left text-ods-text-primary text-h6';
export const CATEGORY_CARD_ACTION_BOX_CLASS = 'ml-4 h-12 w-12 shrink-0 rounded-[6px]';

/** One count of the counts line while it is read: a bar inside the line's real copy. */
function CountSkeleton() {
  return <TextLineSkeleton type="inherit" as="span" className="inline-block w-6 align-top" />;
}

/**
 * A category card while it is read: the card's own boxes (the constants above), its icons as tiles, the title and
 * description as bars of their type steps, the counts line's copy drawn for real with each number a bar, and the
 * action's box.
 */
export function CategoryCardSkeleton({ className }: CategoryCardSkeletonProps) {
  return (
    <article className={cn(CATEGORY_CARD_FRAME_CLASS, className)}>
      <div className={CATEGORY_CARD_ICON_ROW_CLASS}>
        <LoadingItems count={CATEGORY_CARD_SKELETON_ICONS}>
          {() => <UnifiedSkeleton data-loading-item variant="circular" className={CATEGORY_CARD_ICON_TILE_CLASS} />}
        </LoadingItems>
      </div>
      <div className={CATEGORY_CARD_TEXT_BLOCK_CLASS}>
        <TextLineSkeleton type="h2" className={cn(CATEGORY_CARD_TITLE_CLASS, 'w-3/4')} />
        <div className={CATEGORY_CARD_COUNTS_CLASS}>
          <CountSkeleton /> Categories • <CountSkeleton /> Products
        </div>
        <div className={CATEGORY_CARD_DESCRIPTION_ROW_CLASS}>
          <TextLineSkeleton type="h6" className={cn(CATEGORY_CARD_DESCRIPTION_CLASS, 'w-full')} />
          <UnifiedSkeleton className={CATEGORY_CARD_ACTION_BOX_CLASS} />
        </div>
      </div>
    </article>
  );
}
