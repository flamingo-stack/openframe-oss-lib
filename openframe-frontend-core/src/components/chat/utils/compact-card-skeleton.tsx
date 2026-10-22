import { ExternalLink } from 'lucide-react';
import type React from 'react';
import { cn } from '../../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { StatusBadge } from '../../ui/status-badge';
import {
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE_ROW,
  COMPACT_CARD_TITLE_TYPE,
  COMPACT_CARD_TITLE_WRAP_ROW,
  COMPACT_CARD_TRAILING_ICON,
} from './compact-card-classes';

/** One `text-h6` row under the title: its bar's width, its line count, and anything drawn after it in the row. */
export interface CompactCardSkeletonRow {
  /** The bar's width class. Omitted: the row is kept empty (a card whose row holds no read words). */
  width?: string;
  /** Lines of `text-h6`. One line sits in the card's fixed 16px row box; more lines are a free block (a preview). */
  lines?: number;
  /** Drawn after the bar in the same row (an avatar box, a short count bar). */
  after?: React.ReactNode;
}

/** The rows most compact cards draw: a meta line and a summary line. */
const DEFAULT_ROWS: CompactCardSkeletonRow[] = [{ width: 'w-2/5' }, { width: 'w-11/12' }];

/**
 * THE compact (`size="sm"`) entity card while it is read, in the compact card's own boxes: the 56px slot, the title
 * as a bar of the title's own line, the `text-h6` rows, and the trailing link icon (static, drawn for real). Every
 * card's `sm` skeleton is this, configured by the parts that card draws.
 */
export function CompactCardSkeleton({
  slot = true,
  slotClassName,
  titleWidth = 'w-3/5',
  titleBadges = [],
  rows = DEFAULT_ROWS,
  trailingIcon = false,
  className,
}: {
  /** Draw the 56px image/icon slot. */
  slot?: boolean;
  /** A card whose slot is not the standard image slot (the roadmap's bordered logo box). */
  slotClassName?: string;
  titleWidth?: string;
  /** Width classes of the status stamps after the title (`StatusBadge loading variant="button"`); the title row then wraps like the card's. */
  titleBadges?: string[];
  rows?: CompactCardSkeletonRow[];
  /** The card shows the trailing external-link icon. */
  trailingIcon?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(COMPACT_CARD_SKELETON_OUTER, className)} aria-hidden>
      {slot && <UnifiedSkeleton as="span" className={slotClassName ?? COMPACT_CARD_SKELETON_IMAGE_SLOT} />}
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className={titleBadges.length > 0 ? COMPACT_CARD_TITLE_WRAP_ROW : COMPACT_CARD_TITLE_ROW}>
          <TextLineSkeleton as="span" type="inherit" className={cn(COMPACT_CARD_TITLE_TYPE, titleWidth)} />
          {titleBadges.map((width, i) => (
            // The compact cards' title badges are `StatusBadge variant="button"` stamps: their own skeleton.
            <StatusBadge loading text="" key={i} variant="button" className={cn('shrink-0', width)} />
          ))}
        </span>
        {rows.map((row, i) =>
          (row.lines ?? 1) > 1 ? (
            <TextLineSkeleton key={i} as="span" type="h6" lines={row.lines} className={row.width} />
          ) : (
            <span key={i} className={cn(COMPACT_CARD_META_ROW_BOX, row.after ? 'gap-2' : undefined)}>
              {row.width && <TextLineSkeleton as="span" type="h6" className={row.width} />}
              {row.after}
            </span>
          ),
        )}
      </span>
      {trailingIcon && (
        <span className={COMPACT_CARD_TRAILING_ICON}>
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  );
}

/**
 * THE one-line activity row (a card's `variant="row"`) while it is read: the card's leading cells, the flexible text
 * bar, then one fixed `text-h6`-high bar per trailing cell. Shared by every activity row (GitHub, Slack).
 */
export function ActivityRowSkeleton({
  lead,
  trailingWidths,
  className,
}: {
  /** The row's leading cells (its kind icon and its id or author), drawn in the loaded row's own boxes. */
  lead: React.ReactNode;
  /** Width classes of the fixed cells after the text (a repository, a channel, a date). */
  trailingWidths: string[];
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {lead}
      <UnifiedSkeleton className="h-3 w-2/3 flex-1 rounded" />
      {trailingWidths.map((width, i) => (
        <UnifiedSkeleton key={i} className={cn('h-3 shrink-0 rounded', width)} />
      ))}
    </div>
  );
}
