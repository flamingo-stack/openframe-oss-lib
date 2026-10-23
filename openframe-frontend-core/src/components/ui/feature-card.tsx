'use client';

import type React from 'react';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { Card } from './card';
import { useLoadingScope } from './loading-scope';
import { StatusBadge } from './status-badge';

export interface FeatureCardItem {
  icon?: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  iconColor?: string;
  title: string;
  /** Small label above the title (a number such as "01", a category). */
  eyebrow?: string;
  /** One accent line under the title (a tagline). */
  subtitle?: string;
  /**
   * A picture beside the title block (a logo, an avatar). The item then reads
   * as a row: media on the left, eyebrow, title, subtitle and content beside it.
   */
  media?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'card' | 'button';
    colorScheme?: 'cyan' | 'pink' | 'yellow' | 'green' | 'purple' | 'default';
  };
  content: React.ReactNode; // Allow any content to be injected
  /**
   * Pinned to the bottom of the cell, under the content (a row of badges, a
   * link). Cells in one row end on the same line however long their copy is.
   */
  footer?: React.ReactNode;
  // Card-level customization props
  removeAllBorders?: boolean; // Remove all borders for this card
  noBackground?: boolean; // Remove default background
  customBackground?: string; // Custom background color/class
}

export interface FeatureCardGridProps {
  items: FeatureCardItem[];
  /** Items per row from the widest breakpoint (4 shows two per row at `md`). */
  columns?: 2 | 3 | 4;
  className?: string;
  cardClassName?: string;
  itemClassName?: string;
  showBorders?: boolean;
  roundedCorners?: boolean; // Flag to enable rounded corners
  cardGap?: string; // Gap between cards (e.g., 'gap-4', 'gap-6')
  /**
   * The items are still being fetched: the SAME grid, each item's eyebrow, title
   * and subtitle drawn as bars of their own line heights (pass placeholder items
   * for the count and a placeholder `content`).
   */
  loading?: boolean;
  /** Added to every item's title (and its placeholder): e.g. a `min-h-[Nlh]` that keeps rows one height. */
  titleClassName?: string;
  /** Added to every item's subtitle (and its placeholder). */
  subtitleClassName?: string;
  /** The subtitle's colour. Defaults to the platform accent. */
  accentClassName?: string;
  /**
   * The shape of the grid while its items are read (a page's loading state, where `items` is empty): how many
   * items, and which of their parts they carry. Defaults to one row of title-only items.
   */
  skeleton?: FeatureCardGridSkeletonShape;
}

/** The parts each item of a loading grid carries; every read word is a bar of its own line height. */
export interface FeatureCardGridSkeletonShape {
  /** Items drawn. Defaults to one row (`columns`). */
  count?: number;
  /** An eyebrow above the title: a bar, or `'index'` for the item's own number ("01", "02"), drawn for real. */
  eyebrow?: boolean | 'index';
  /** A subtitle under the title. */
  subtitle?: boolean;
  /** A picture beside the title block: the classes of its box (its size and radius), drawn as a box. */
  media?: string;
  /** Lines of body copy under the title. */
  contentLines?: 1 | 2 | 3;
  /** The type step of that copy. Defaults to `h4`. */
  contentType?: 'h4' | 'h6';
}

/** Items a loading grid draws when it is told neither a count nor its columns: one row of the grid's default three
 *  columns (`FeatureCardGridView`'s `columns`). */
const FEATURE_CARD_GRID_SKELETON_ITEMS = 3;

const GRID_COLUMNS = {
  2: 'grid-cols-1 content-md:grid-cols-2',
  3: 'grid-cols-1 content-md:grid-cols-3',
  4: 'grid-cols-1 content-md:grid-cols-2 content-lg:grid-cols-4',
} as const;

/**
 * The hairlines of a four-column row, which is two per row at `md`: a right
 * line between neighbours at each width, a bottom line under every row but the
 * last at each width. Spelled out, never assembled: Tailwind only emits a class
 * it can read in the source.
 */
function fourColumnBorders(index: number, count: number): string {
  const classes = ['border-ods-border'];
  if (index < count - 1) classes.push('border-b');
  const mdRows = Math.ceil(count / 2);
  const lgRows = Math.ceil(count / 4);
  classes.push(index % 2 === 0 && index < count - 1 ? 'content-md:border-r' : 'content-md:border-r-0');
  classes.push(Math.floor(index / 2) < mdRows - 1 ? 'content-md:border-b' : 'content-md:border-b-0');
  classes.push(index % 4 !== 3 && index < count - 1 ? 'content-lg:border-r' : 'content-lg:border-r-0');
  classes.push(Math.floor(index / 4) < lgRows - 1 ? 'content-lg:border-b' : 'content-lg:border-b-0');
  return ` ${classes.join(' ')}`;
}

function FeatureCardGridView({
  items,
  columns = 3,
  className = '',
  // The grid is its hairlines: no outer frame and no surface of its own, so it
  // sits on whatever band it is placed in.
  cardClassName = 'bg-transparent border-0 shadow-none rounded-none p-0',
  itemClassName = 'bg-transparent p-10',
  showBorders = true,
  roundedCorners = false,
  cardGap = '',
  loading = false,
  titleClassName = '',
  subtitleClassName = '',
  accentClassName = 'text-ods-accent',
  loadingKeepsEyebrow = false,
}: Omit<FeatureCardGridProps, 'skeleton'> & {
  /** While `loading`: the eyebrow is the item's own number, drawn for real. */
  loadingKeepsEyebrow?: boolean;
}) {
  const gridCols = GRID_COLUMNS[columns];
  const itemsPerRow = columns;
  const rows = Math.ceil(items.length / itemsPerRow);

  const getBorderClasses = (isLastRow: boolean, isLastInRow: boolean, globalIndex: number) => {
    if (!showBorders) return '';
    if (columns === 4) return fourColumnBorders(globalIndex, items.length);

    let classes = '';

    // Right border - responsive logic
    if (!isLastInRow) {
      // On mobile (1 column), never show right border
      // On desktop (2/3 columns), show right border except for last in row
      classes += ' content-md:border-r border-ods-border';
    }

    // Bottom border logic
    const isLastItem = globalIndex === items.length - 1;

    // Mobile: bottom border for all except last item
    if (!isLastItem) {
      classes += ' border-b border-ods-border';
    }

    // Desktop: override mobile border, show bottom border for all rows except last
    if (!isLastRow) {
      classes += ' content-md:border-b border-ods-border';
    } else {
      // Last row on desktop - remove bottom border
      classes += ' content-md:border-b-0';
    }

    return classes;
  };

  // Check if all cards have noBackground to modify card container
  const allCardsHaveNoBackground = items.every(item => item.noBackground);
  const allCardsHaveNoBorders = items.every(item => item.removeAllBorders);

  let finalCardClassName = cardClassName;
  if (allCardsHaveNoBackground) {
    finalCardClassName = finalCardClassName.replace('bg-ods-card', 'bg-transparent');
  }
  if (allCardsHaveNoBorders) {
    finalCardClassName = 'bg-transparent p-0 overflow-visible border-0 shadow-none rounded-none';
  }

  return (
    <Card className={`${finalCardClassName} ${className}`}>
      {Array.from({ length: rows }, (_, rowIndex) => {
        const startIndex = rowIndex * itemsPerRow;
        const rowItems = items.slice(startIndex, startIndex + itemsPerRow);
        const isLastRow = rowIndex === rows - 1;

        return (
          <div key={rowIndex} className={`grid ${gridCols} ${cardGap}`}>
            {rowItems.map((item, itemIndex) => {
              const globalIndex = startIndex + itemIndex;
              const isLastInRow = itemIndex === rowItems.length - 1;
              const borderClasses = getBorderClasses(isLastRow, isLastInRow, globalIndex);

              // Apply card-level customizations
              let finalItemClassName = itemClassName;
              let finalBorderClasses = borderClasses;

              // Handle background customization
              if (item.noBackground) {
                finalItemClassName = finalItemClassName.replace('bg-ods-bg', 'bg-transparent');
              } else if (item.customBackground) {
                finalItemClassName = finalItemClassName.replace(/bg-ods-bg|bg-transparent/, item.customBackground);
              }

              // Handle border removal
              if (item.removeAllBorders) {
                finalBorderClasses = '';
              }

              // Handle rounded corners
              if (roundedCorners) {
                finalItemClassName += ' rounded-lg';
              }

              return (
                <div
                  key={globalIndex}
                  className={`${finalItemClassName}${finalBorderClasses} relative`}
                  style={item.customBackground ? { backgroundColor: item.customBackground } : undefined}
                >
                  <div
                    className={
                      !item.icon && !item.title
                        ? 'flex h-full flex-col'
                        : item.footer
                          ? 'flex h-full flex-col gap-6'
                          : 'space-y-6'
                    }
                  >
                    {item.icon && (
                      <div className="flex items-start justify-between">
                        <item.icon size={80} color={item.iconColor} />
                        {item.badge && (
                          <StatusBadge
                            text={item.badge.text}
                            variant={item.badge.variant || 'card'}
                            colorScheme={item.badge.colorScheme || 'default'}
                          />
                        )}
                      </div>
                    )}

                    {!item.icon && item.badge && (
                      <div className="flex items-start justify-end">
                        <StatusBadge
                          text={item.badge.text}
                          variant={item.badge.variant || 'card'}
                          colorScheme={item.badge.colorScheme || 'default'}
                        />
                      </div>
                    )}

                    {item.media ? (
                      <div className="flex gap-[var(--spacing-system-lf)]">
                        <div className="shrink-0">{item.media}</div>
                        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xsf)]">
                          {item.eyebrow && (
                            <span className="text-ods-text-secondary text-h5">
                              {loading && !loadingKeepsEyebrow ? (
                                <TextLineSkeleton type="inherit" as="span" className="w-6" />
                              ) : (
                                item.eyebrow
                              )}
                            </span>
                          )}
                          <h3 className={`text-ods-text-primary text-h2 ${titleClassName}`}>
                            {loading ? <TextLineSkeleton type="inherit" as="span" className="w-1/2" /> : item.title}
                          </h3>
                          {item.subtitle && (
                            <p className={`text-h4 ${accentClassName} ${subtitleClassName}`}>
                              {loading ? (
                                <TextLineSkeleton type="inherit" as="span" className="w-3/4" />
                              ) : (
                                item.subtitle
                              )}
                            </p>
                          )}
                          {item.content}
                        </div>
                      </div>
                    ) : item.eyebrow || item.subtitle ? (
                      <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
                        {item.eyebrow && (
                          <span className="text-ods-text-secondary text-h5">
                            {loading && !loadingKeepsEyebrow ? (
                              <TextLineSkeleton type="inherit" as="span" className="w-6" />
                            ) : (
                              item.eyebrow
                            )}
                          </span>
                        )}
                        <h3 className={`whitespace-pre-line text-ods-text-primary text-h2 ${titleClassName}`}>
                          {loading ? <TextLineSkeleton type="inherit" as="span" className="w-1/2" /> : item.title}
                        </h3>
                        {item.subtitle && (
                          <p className={`text-h4 ${accentClassName} ${subtitleClassName}`}>
                            {loading ? <TextLineSkeleton type="inherit" as="span" className="w-3/4" /> : item.subtitle}
                          </p>
                        )}
                      </div>
                    ) : (
                      <h3 className="whitespace-pre-line text-ods-text-primary text-h2">
                        {loading ? <TextLineSkeleton type="inherit" as="span" className="w-1/2" /> : item.title}
                      </h3>
                    )}

                    {!item.media && item.content}

                    {item.footer && <div className="mt-auto">{item.footer}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </Card>
  );
}

/**
 * FeatureCardGrid: a grid of items split by hairlines. In a page's loading state with no items yet (they are
 * read) it draws its skeleton, `FeatureCardGridSkeleton` of `skeleton`'s shape; items it is given there are the
 * page's own copy and draw as they are.
 */
export function FeatureCardGrid({ skeleton, ...props }: FeatureCardGridProps) {
  const inScope = useLoadingScope();
  if (inScope && props.items.length === 0) {
    const { items: _items, loading: _loading, ...grid } = props;
    return <FeatureCardGridSkeleton {...grid} {...skeleton} />;
  }
  return <FeatureCardGridView {...props} />;
}

/**
 * A FeatureCardGrid while its items are read: the same grid (its columns, hairlines and item padding), each
 * item's eyebrow, title, subtitle and copy a bar of its own line height, its picture a box.
 */
function FeatureCardGridSkeleton({
  count,
  eyebrow,
  subtitle,
  media,
  contentLines,
  contentType = 'h4',
  ...grid
}: Omit<FeatureCardGridProps, 'items' | 'loading' | 'skeleton'> & FeatureCardGridSkeletonShape) {
  const items: FeatureCardItem[] = Array.from(
    { length: count ?? grid.columns ?? FEATURE_CARD_GRID_SKELETON_ITEMS },
    (_, index) => ({
      title: '',
      eyebrow: eyebrow ? String(index + 1).padStart(2, '0') : undefined,
      subtitle: subtitle ? '-' : undefined,
      media: media ? <UnifiedSkeleton className={media} /> : undefined,
      content: contentLines ? <TextLineSkeleton type={contentType} lines={contentLines} className="w-full" /> : null,
    }),
  );
  return <FeatureCardGridView {...grid} items={items} loading loadingKeepsEyebrow={eyebrow === 'index'} />;
}
