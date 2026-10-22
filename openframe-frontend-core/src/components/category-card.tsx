'use client';

import type React from 'react';
import { cn } from '../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from './loading/unified-skeleton';
import { LoadingItems, useLoadingScope } from './ui/loading-scope';

interface CategoryCardSkeletonProps {
  className?: string;
}

/** Vendor icons a typical card shows: the loading card draws that many. */
const CATEGORY_CARD_SKELETON_ICONS = 10;
/** The card's boxes, read by `CategoryCard` and by this skeleton, so both are one box. */
const CATEGORY_CARD_FRAME_CLASS =
  'box-border flex min-w-0 flex-col rounded-[12px] border border-ods-border bg-ods-card p-8';
/** The icon row keeps one tile's height with no icons, so a card given none is the loading card's height. */
const CATEGORY_CARD_ICON_ROW_CLASS = 'mb-8 flex min-h-10 items-center justify-center gap-6';
const CATEGORY_CARD_ICON_TILE_CLASS = 'h-10 w-10 flex-shrink-0';
const CATEGORY_CARD_TEXT_BLOCK_CLASS = 'flex flex-1 flex-col';
const CATEGORY_CARD_TITLE_CLASS = 'mb-2 text-left text-ods-text-primary text-h2';
const CATEGORY_CARD_COUNTS_CLASS = 'mb-4 text-left text-ods-text-secondary text-h6';
const CATEGORY_CARD_DESCRIPTION_ROW_CLASS = 'flex flex-row items-start';
const CATEGORY_CARD_DESCRIPTION_CLASS = 'flex-1 text-left text-ods-text-primary text-h6';
const CATEGORY_CARD_ACTION_BOX_CLASS = 'ml-4 h-12 w-12 shrink-0 rounded-[6px]';

/** One count of the counts line while it is read: a bar inside the line's real copy. */
function CountSkeleton() {
  return <TextLineSkeleton type="inherit" as="span" className="inline-block w-6 align-top" />;
}

/**
 * A category card while it is read: the card's own boxes (the constants above), its icons as tiles, the title and
 * description as bars of their type steps, the counts line's copy drawn for real with each number a bar, and the
 * action's box.
 */
function CategoryCardSkeleton({ className }: CategoryCardSkeletonProps) {
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

interface CategoryCardProps {
  name: string;
  description: string;
  categoryCount: number;
  productCount: number;
  icons?: React.ReactNode[];
}

export function CategoryCard({ name, description, categoryCount, productCount, icons = [] }: CategoryCardProps) {
  // ONE switch: in a page's loading state the category is read: the card is its skeleton.
  if (useLoadingScope()) return <CategoryCardSkeleton />;
  return (
    <article className={CATEGORY_CARD_FRAME_CLASS}>
      {/* A card given no icons draws an empty row, one tile high (the row's own minimum height). */}
      <div className={CATEGORY_CARD_ICON_ROW_CLASS}>
        {icons.map((icon, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: the host's icons carry no identity of their own
            key={i}
            data-loading-item
            className={cn(CATEGORY_CARD_ICON_TILE_CLASS, 'flex items-center justify-center rounded bg-ods-border')}
          >
            {icon}
          </div>
        ))}
      </div>
      <div className={CATEGORY_CARD_TEXT_BLOCK_CLASS}>
        <h2 className={CATEGORY_CARD_TITLE_CLASS}>{name}</h2>
        <div className={CATEGORY_CARD_COUNTS_CLASS}>
          {categoryCount} Categories • {productCount} Products
        </div>
        <div className={CATEGORY_CARD_DESCRIPTION_ROW_CLASS}>
          <p className={CATEGORY_CARD_DESCRIPTION_CLASS}>{description}</p>
          <button
            className={cn(
              CATEGORY_CARD_ACTION_BOX_CLASS,
              'flex items-center justify-center border border-ods-border bg-transparent text-ods-text-primary transition-colors hover:bg-ods-accent',
            )}
            aria-label={`View ${name}`}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
