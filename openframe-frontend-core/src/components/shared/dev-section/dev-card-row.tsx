'use client';

/**
 * Shared row chrome for any `DevSectionPage` list (delivery, tickets,
 * future sections). One source of truth for the layout that every
 * dev-section card row uses:
 *   left column  → title (h3) / subtitle (h5 uppercase) / description
 *                  (h4 line-clamp-3), each in a fixed min-height block
 *                  so rows align across the grid
 *   right column → caller-supplied stacked badges
 *
 * Surface stays small on purpose — `rightBadges` is a `ReactNode` so
 * the caller decides how many badges (delivery: 2, tickets: 1-2,
 * future: anything). No behavior baked in: the caller wraps the row
 * in a `<div>` (static, like delivery) or `<button>` (clickable, like
 * tickets) and renders the row content via this component.
 *
 * Pair with `DevCardRowSkeletonList` for the loading state — the
 * skeleton mirrors the same min-heights so the in-flight UI doesn't
 * shift the layout when real data lands.
 *
 * NOTE: the ticket conversation row is NOT here — it renders the shared
 * `<ChatMessageRow>` (`components/chat/chat-message-row.tsx`), the SAME
 * component the OpenMSP Slack-community feed uses, so the two surfaces stay
 * pixel-identical by construction.
 */

import type { ReactNode } from 'react';
import { TEXT_LINES_MIN } from '../../../styles/component-sizes';
import { LoadingRegion } from '../../loading/loading-region';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { StatusBadgeSkeleton } from '../../ui/status-badge';

export interface DevCardRowContentProps {
  title: string;
  /** Single-line uppercase metadata (e.g. "UPDATED today, #4271, Code review"). */
  subtitle: string;
  /** 3-line description block. Empty string renders the fallback. */
  description: string;
  /** Fallback copy when `description` is empty. Defaults to a generic
   *  string; ticket / delivery surfaces override. */
  emptyDescription?: string;
  /** Right column — caller renders its own stacked badges. */
  rightBadges: ReactNode;
}

/** The row's layout, read by the row and by its skeleton, so the skeleton is the row's size. */
const ROW_INNER_CLASS =
  'flex w-full flex-col items-start justify-between gap-[12px] content-md:flex-row content-md:gap-[16px]';
const ROW_TEXT_COLUMN_CLASS = 'flex w-full min-w-0 flex-1 flex-col gap-[12px] content-md:w-auto content-md:gap-[16px]';
const ROW_TITLE_LINE_CLASS = `flex items-center text-h3 ${TEXT_LINES_MIN[1]}`;
const ROW_SUBTITLE_LINE_CLASS = `flex items-center text-h5 ${TEXT_LINES_MIN[1]}`;
const ROW_DESCRIPTION_LINE_CLASS = `flex items-center text-h4 ${TEXT_LINES_MIN[3]}`;
const ROW_BADGES_CLASS = 'flex flex-shrink-0 flex-col gap-2 self-start';

export function DevCardRowContent({
  title,
  subtitle,
  description,
  emptyDescription = 'No description provided',
  rightBadges,
}: DevCardRowContentProps) {
  // While the page is read the record is not known: the row's content is its skeleton.
  if (useLoadingScope()) return <DevCardRowContentSkeleton />;
  return (
    <div className={ROW_INNER_CLASS}>
      <div className={ROW_TEXT_COLUMN_CLASS}>
        <div className={ROW_TITLE_LINE_CLASS}>
          <h3 className="line-clamp-2 flex-1 break-words tracking-[-0.36px] text-ods-text-primary text-h3 content-md:truncate">
            {title}
          </h3>
        </div>
        <div className={ROW_SUBTITLE_LINE_CLASS}>
          <p className="truncate uppercase tracking-[-0.28px] text-ods-text-secondary text-h5">{subtitle}</p>
        </div>
        <div className={ROW_DESCRIPTION_LINE_CLASS}>
          <p className="line-clamp-3 break-words text-ods-text-secondary text-h4">{description || emptyDescription}</p>
        </div>
      </div>
      <div className={ROW_BADGES_CLASS}>{rightBadges}</div>
    </div>
  );
}

/** A row's content while its record is read: the title, subtitle and description as bars, two badge skeletons. */
export function DevCardRowContentSkeleton() {
  return (
    <div className={ROW_INNER_CLASS} aria-hidden>
      <div className={ROW_TEXT_COLUMN_CLASS}>
        <div className={ROW_TITLE_LINE_CLASS}>
          <TextLineSkeleton type="h3" className="w-full" />
        </div>
        <div className={ROW_SUBTITLE_LINE_CLASS}>
          <TextLineSkeleton type="h5" className="w-1/2" />
        </div>
        <div className={ROW_DESCRIPTION_LINE_CLASS}>
          <TextLineSkeleton type="h4" lines={3} className="w-full" />
        </div>
      </div>
      <div className={ROW_BADGES_CLASS}>
        <StatusBadgeSkeleton variant="card" />
        <StatusBadgeSkeleton variant="card" />
      </div>
    </div>
  );
}

/**
 * Skeleton rendering for a single row — the bars mirror the same
 * min-heights as `DevCardRowContent` so the loading→loaded swap
 * doesn't reflow.
 */
export function DevCardRowSkeleton() {
  return (
    <div className="border-b border-ods-border p-[12px] last:border-b-0 content-md:p-[16px]">
      <DevCardRowContentSkeleton />
    </div>
  );
}

/** Rows a list with no page size draws while it loads: a typical count. */
const DEV_CARD_ROW_SKELETON_ROWS = 5;

/**
 * The skeleton rows inside a bordered card: the loading state of every list shell. A list draws ONE FULL PAGE, so
 * a paged list passes its page size (the tickets list passes its own); `5` is the typical count for a list with none.
 */
export function DevCardRowSkeletonList({
  region = true,
  rows = DEV_CARD_ROW_SKELETON_ROWS,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  /** Rows to draw: the list's page size. Default `5`. */
  rows?: number;
}) {
  return (
    <LoadingRegion
      label="Loading"
      announce={region}
      className="w-full overflow-hidden rounded-[6px] border border-ods-border bg-ods-card"
    >
      {Array.from({ length: rows }, (_, i) => (
        <DevCardRowSkeleton key={i} />
      ))}
    </LoadingRegion>
  );
}
