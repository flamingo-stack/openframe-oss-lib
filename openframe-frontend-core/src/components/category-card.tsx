'use client';

import type React from 'react';
import { cn } from '../utils/cn';
import {
  CATEGORY_CARD_ACTION_BOX_CLASS,
  CATEGORY_CARD_COUNTS_CLASS,
  CATEGORY_CARD_DESCRIPTION_CLASS,
  CATEGORY_CARD_DESCRIPTION_ROW_CLASS,
  CATEGORY_CARD_FRAME_CLASS,
  CATEGORY_CARD_ICON_ROW_CLASS,
  CATEGORY_CARD_ICON_TILE_CLASS,
  CATEGORY_CARD_TEXT_BLOCK_CLASS,
  CATEGORY_CARD_TITLE_CLASS,
  CategoryCardSkeleton,
} from './loading/category-card-skeleton';
import { useLoadingScope } from './ui/loading-scope';

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
