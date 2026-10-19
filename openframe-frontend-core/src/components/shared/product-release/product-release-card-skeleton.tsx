'use client';

import { cn } from '../../../utils/cn';
import { CONTENT_CARD_SKELETON_FRAME_CLASS } from '../../chat/entity-cards/content-card-frame';
import { EntityMetadataAuthorCellSkeleton } from '../../chat/entity-cards/entity-author-card';
import { TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { StatusBadgeSkeleton } from '../../ui/status-badge';
import {
  RELEASE_CARD_CELL_CLASS,
  RELEASE_CARD_CELL_DIVIDER_CLASS,
  RELEASE_CARD_CELL_LABEL_CLASS,
  RELEASE_CARD_CELL_LABELS,
  RELEASE_CARD_CELL_STACK_CLASS,
  RELEASE_CARD_CHANGELOG_CLASS,
  RELEASE_CARD_COVER_BOX_CLASS,
  RELEASE_CARD_COVER_COLUMN_CLASS,
  RELEASE_CARD_GRID_CLASS,
  RELEASE_CARD_HERO_CLASS,
  RELEASE_CARD_LG_FRAME_CLASS,
  RELEASE_CARD_SUMMARY_BOX_CLASS,
  RELEASE_CARD_SUMMARY_CLASS,
  RELEASE_CARD_TEXT_COLUMN_CLASS,
  RELEASE_CARD_TITLE_BOX_CLASS,
  RELEASE_CARD_TITLE_CLASS,
  RELEASE_CARD_VERSION_CLASS,
  RELEASE_CARD_VERSION_ROW_CLASS,
} from './product-release-card-classes';

export interface ProductReleaseCardSkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Card density. Must match the loaded card's `size` prop so the loading
   *  height matches the resolved height (no layout shift on resolve). */
  size?: 'lg' | 'sm';
}

export function ProductReleaseCardSkeleton({ className, size = 'lg' }: ProductReleaseCardSkeletonProps) {
  // ----- LG branch — must match ProductReleaseCard size='lg'.
  // Same outer frame (`bg-ods-card border border-ods-border …
  // p-6 gap-4`). Inner: hero (16:9 cover + version pill + title + summary),
  // changelog strip placeholder, metadata-grid footer (4 cells via grid).
  // Heights chosen to match the loaded card's rendered metrics so the
  // 5-card slot grid in `ReleasesList` doesn't jump on resolve. The
  // loaded card ALSO always renders the changelog strip + a fixed 4-cell
  // grid (with em-dash placeholders for missing values), so this
  // skeleton's shape matches exactly with zero load-to-resolve reflow.
  if (size === 'lg') {
    // The card's own classes (`product-release-card-classes`): each read text is a bar of its own line box inside
    // the loaded element, the grid's labels are real, the author cell is the shared metadata author skeleton.
    return (
      <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, RELEASE_CARD_LG_FRAME_CLASS, className)} aria-hidden>
        <div className={RELEASE_CARD_HERO_CLASS}>
          <div className={RELEASE_CARD_COVER_COLUMN_CLASS}>
            <UnifiedSkeleton className={RELEASE_CARD_COVER_BOX_CLASS} />
          </div>
          <div className={RELEASE_CARD_TEXT_COLUMN_CLASS}>
            <div className={RELEASE_CARD_VERSION_ROW_CLASS}>
              <span className={RELEASE_CARD_VERSION_CLASS}>
                <TextLineSkeleton type="inherit" as="span" className="w-16" />
              </span>
            </div>
            <div className={RELEASE_CARD_TITLE_BOX_CLASS}>
              <h3 className={cn(RELEASE_CARD_TITLE_CLASS, 'w-full')}>
                <TextLineSkeleton type="inherit" as="span" lines={2} className="w-3/4" />
              </h3>
            </div>
            <div className={RELEASE_CARD_SUMMARY_BOX_CLASS}>
              <p className={RELEASE_CARD_SUMMARY_CLASS}>
                <TextLineSkeleton type="inherit" as="span" lines={3} className="w-full" />
              </p>
            </div>
          </div>
        </div>
        {/* The changelog's counts are read list items (which ones show is read data): one row's first item. */}
        <div className={RELEASE_CARD_CHANGELOG_CLASS}>
          <span data-loading-item className="inline-flex">
            <TextLineSkeleton type="inherit" as="span" className="w-24" />
          </span>
        </div>
        <div className={RELEASE_CARD_GRID_CLASS}>
          {RELEASE_CARD_CELL_LABELS.map((label, i) => (
            <div key={label} className={cn(RELEASE_CARD_CELL_CLASS, RELEASE_CARD_CELL_DIVIDER_CLASS)}>
              <div className={RELEASE_CARD_CELL_STACK_CLASS}>
                {/* The Type value is a card StatusBadge loaded; the others are a text-h4 line. */}
                {i === 0 ? (
                  <StatusBadgeSkeleton variant="card" className="self-start" />
                ) : (
                  <p className="text-h4">
                    <TextLineSkeleton type="inherit" as="span" className="w-24" />
                  </p>
                )}
                <p className={RELEASE_CARD_CELL_LABEL_CLASS}>{label}</p>
              </div>
            </div>
          ))}
          <EntityMetadataAuthorCellSkeleton />
        </div>
      </div>
    );
  }

  // ----- COMPACT branch — must match ProductReleaseCard size='sm' exactly.
  // Same outer: span + items-start + gap-3 + p-2 + my-1.5 (no border to keep
  // the skeleton 1px lighter than the resolved card is fine — but we mirror
  // the border too so width is byte-identical). Inner row 1 = title +
  // version-pill; row 2 = date; row 3 = summary line. Heights/widths chosen
  // to match the rendered card line-heights (text-sm = 14px line-height-20,
  // text-[11px] = 11/16). The total height comes out the same as the loaded
  // card so the chat message height does NOT jump on resolve.
  if (size === 'sm') {
    return (
      <span
        className={cn(
          'my-1.5 flex w-full items-start gap-3',
          'rounded-lg border border-ods-border bg-ods-card p-2',
          className,
        )}
      >
        <UnifiedSkeleton as="span" className="block aspect-square h-14 w-14 shrink-0 self-start rounded-md" />
        {/* Text column: 3 rows with FIXED heights matching the loaded
            card (h-5 title, h-4 + h-4 meta + summary). Skeleton bars
            sit centered inside each row container so a placeholder
            occupies the SAME pixel position as the loaded text will
            on resolve. */}
        <span className="flex min-h-14 min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex h-5 min-w-0 items-center gap-2">
            <UnifiedSkeleton as="span" className="h-3.5 w-3/5 rounded" />
            <UnifiedSkeleton as="span" className="h-4 w-12 shrink-0 rounded" />
          </span>
          <span className="flex h-4 min-w-0 items-center">
            <UnifiedSkeleton as="span" className="h-3 w-1/3 rounded" />
          </span>
          <span className="flex h-4 min-w-0 items-center">
            <UnifiedSkeleton as="span" className="h-3 w-11/12 rounded" />
          </span>
        </span>
      </span>
    );
  }

  // Unreachable — `size` is typed `'lg' | 'sm'` and both branches return
  // above. Kept as a defensive throw so a future variant addition that
  // forgets to return doesn't silently render `undefined`.
  throw new Error(`ProductReleaseCardSkeleton: unsupported size '${size as string}'`);
}
