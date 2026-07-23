'use client';

import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface AnnouncementBarViewProps {
  /**
   * Leading slot — typically an icon. Rendered before the title. Per the
   * mockup icons are 16px below `md` and 24px from `md` up — size them with
   * the responsive token: `size-[var(--icon-size-icon-size)]`.
   */
  startAdornment?: ReactNode;
  /**
   * Bar message. A plain string gets the mockup's text treatment (`text-h4`,
   * single line from `md` up, wrapping below); pass a ReactElement to fully
   * own the markup/typography (e.g. bold title + inline description).
   */
  title?: string | ReactElement;
  /**
   * Primary CTA. From `md` up it sits at content width in one trailing
   * container with `endAdornment`; below `md` it drops to its own
   * full-width second row (Figma ODS 2862-8391). Omit it entirely to
   * collapse that row — the bar height then follows the remaining content.
   */
  actionBlock?: ReactElement;
  /**
   * Trailing slot (e.g. a dismiss button). Always keeps its content width:
   * inline after the title below `md` (and on every breakpoint when there is
   * no `actionBlock`), after the action from `md` up. NOTE: with an
   * `actionBlock` present the element is mounted twice (one copy per
   * breakpoint, the inactive one `display:none`) — keep it stateless.
   */
  endAdornment?: ReactElement;
  /** Surface styling (background, text color, theme scope) is the consumer's — pass it here. */
  className?: string;
  style?: CSSProperties;
}

/**
 * Pure presentational announcement/notification bar (Figma 9364-40603 desktop,
 * 9418-43969 tablet, ODS 2862-8391 mobile). No data fetching, storage, or
 * navigation — consumers own state and pass content through slots.
 *
 * Layout: `md` (800px) and up is a single row — `startAdornment` + title
 * (flex-1, truncating) + trailing container (`actionBlock` + `endAdornment`)
 * at content width. Below `md`: `startAdornment` + wrapping title +
 * `endAdornment` share the first row (top-aligned so a two-line title keeps
 * the adornments on line one, each centered in a line-height box), and the
 * action alone stretches across its own second row. No action → no second
 * row; the bar height follows the content. Spacing/typography use responsive
 * ODS tokens, so paddings and font sizes track the breakpoint automatically.
 */
export function AnnouncementBarView({
  startAdornment,
  title,
  actionBlock,
  endAdornment,
  className,
  style,
}: AnnouncementBarViewProps) {
  // Below `md` adornments center inside a box matching the title's first
  // text line (20px), so `items-start` keeps them on line one of a wrapped
  // title without hugging the row's top edge. From `md` up the row is
  // single-line and center-aligned, so the boxes dissolve (`h-auto`).
  const adornmentBox = 'flex h-5 shrink-0 items-center md:h-auto';

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-s)] px-[var(--spacing-system-l)] py-[var(--spacing-system-sf)] md:flex-row md:items-center',
        className,
      )}
      style={style}
    >
      <div className="flex min-w-0 flex-1 items-start gap-[var(--spacing-system-s)] md:items-center">
        {startAdornment && <div className={adornmentBox}>{startAdornment}</div>}
        {typeof title === 'string' ? (
          <p className="min-w-0 flex-1 break-words text-h4 md:truncate">{title}</p>
        ) : (
          title != null && <div className="min-w-0 flex-1">{title}</div>
        )}
        {/* Mobile home of the trailing adornment — and its only home when
            there is no action row to share from `md` up. */}
        {endAdornment && <div className={cn(adornmentBox, actionBlock && 'md:hidden')}>{endAdornment}</div>}
      </div>
      {actionBlock && (
        <div className="flex w-full shrink-0 items-center gap-[var(--spacing-system-s)] md:w-auto">
          <div className="flex min-w-0 flex-1 md:flex-none [&>*]:w-full md:[&>*]:w-auto">{actionBlock}</div>
          {endAdornment && <div className="hidden shrink-0 md:flex">{endAdornment}</div>}
        </div>
      )}
    </div>
  );
}
