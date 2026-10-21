'use client';

import type React from 'react';
import { cn } from '../utils/cn';
import {
  CATEGORY_CARD_ACTION_BOX_CLASS,
  CATEGORY_CARD_FRAME_CLASS,
  CATEGORY_CARD_ICON_ROW_CLASS,
  CATEGORY_CARD_ICON_TILE_CLASS,
  CATEGORY_CARD_SKELETON_ICONS,
  CategoryCardSkeleton,
} from './loading/category-card-skeleton';
import { LoadingItems, useLoadingScope } from './ui/loading-scope';

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
      <div className={CATEGORY_CARD_ICON_ROW_CLASS}>
        {icons.length > 0 ? (
          icons.map((icon, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the host's icons carry no identity of their own
              key={i}
              data-loading-item
              className={cn(CATEGORY_CARD_ICON_TILE_CLASS, 'flex items-center justify-center rounded bg-ods-border')}
            >
              {icon}
            </div>
          ))
        ) : (
          <LoadingItems count={CATEGORY_CARD_SKELETON_ICONS}>
            {() => (
              <div
                data-loading-item
                className={cn(CATEGORY_CARD_ICON_TILE_CLASS, 'flex items-center justify-center rounded bg-ods-border')}
              />
            )}
          </LoadingItems>
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <h2 className="mb-2 text-left text-ods-text-primary text-h2">{name}</h2>
        <div className="mb-4 text-left text-ods-text-secondary text-h6">
          {categoryCount} Categories • {productCount} Products
        </div>
        <div className="flex flex-row items-start">
          <p className="flex-1 text-left text-ods-text-primary text-h6">{description}</p>
          <button
            className={cn(
              CATEGORY_CARD_ACTION_BOX_CLASS,
              'ml-4 flex items-center justify-center border border-ods-border bg-transparent transition-colors hover:bg-ods-accent',
            )}
            style={{ minWidth: 48, minHeight: 48 }}
            aria-label={`View ${name}`}
          >
            <svg width="24" height="24" fill="none" stroke="#FAFAFA" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
