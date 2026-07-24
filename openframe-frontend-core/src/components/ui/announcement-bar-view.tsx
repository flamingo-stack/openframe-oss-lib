'use client';

import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface AnnouncementBarViewProps {
  /**
   * Leading slot — typically an icon, at content width before the title. Size
   * it in the slot: the bar's icon is 16px below `md` (must not exceed the
   * 20px title row, Figma 9418-52387) and 24px from `md` up.
   */
  startAdornment?: ReactNode;
  /**
   * Bar message. A plain string gets the mockup's text treatment (`text-h4` =
   * DM Sans 500, 14/20 below `md` and 18/24 from `md` up), wrapping below `md`
   * and truncating to one line from `md` up. Pass a ReactElement to own the
   * markup (e.g. bold title + inline description) — mirror that responsive
   * wrap/truncate pair in your element.
   */
  title?: string | ReactElement;
  /**
   * Primary CTA. From `md` up it sits inline at content width between the
   * title and `endAdornment`; below `md` it moves to its own full-width row
   * under the content (Figma 2862-8391) and the bar's height grows to fit.
   */
  actionBlock?: ReactElement;
  /** Trailing slot (e.g. a dismiss button) — stays in the top/content row on every breakpoint. */
  endAdornment?: ReactElement;
  /** Surface styling (background, text color, theme scope) is the consumer's — pass it here. */
  className?: string;
  style?: CSSProperties;
}

/**
 * Pure presentational announcement/notification bar. No data fetching,
 * storage, or navigation — consumers own state and pass content through slots.
 *
 * Layout (Figma 9418-52494 desktop/tablet, 2862-8391 mobile):
 * - `md` (800px) and up: ONE row inside a strip FIXED at 56px (`md:min-h-14`,
 *   32px CTA + 12px vertical insets) — reserved unconditionally, so toggling
 *   or removing the action never resizes the bar on desktop/tablet. Title
 *   truncates to one line.
 * - Below `md`: the container stacks (`px` 16 / `py` 8 / gap 8). Top row =
 *   `startAdornment` + wrapping title + `endAdornment`; when an `actionBlock`
 *   is present it renders as a VISIBLE full-width button on its own second
 *   row and the bar's height adapts to content (76px with a single-line
 *   title and CTA per Figma 9418-52387: 8 + 20 + 8 + 32 + 8).
 *
 * The `actionBlock` element is mounted in both positions (inline `md`-up slot
 * and the mobile full-width row); exactly one is `display:none` at any width,
 * so keyboard/AT always reach exactly one control.
 */
export function AnnouncementBarView({
  startAdornment,
  title,
  actionBlock,
  endAdornment,
  className,
  style,
}: AnnouncementBarViewProps) {
  return (
    <div
      className={cn(
        'flex w-full max-w-full flex-col gap-[var(--spacing-system-s)] px-[var(--spacing-system-l)] py-[var(--spacing-system-s)] md:min-h-14 md:flex-row md:items-center md:py-0',
        className,
      )}
      style={style}
    >
      {/* Content row: leading icon + title (+ inline CTA from `md`) + trailing
          slot. `items-start` below `md` keeps the adornments pinned to the
          first text line when the title wraps; `md:items-center` re-centers
          everything in the fixed strip. */}
      <div className="flex w-full min-w-0 flex-1 items-start gap-[var(--spacing-system-s)] md:w-auto md:items-center">
        {startAdornment && <div className="flex shrink-0 items-center">{startAdornment}</div>}
        {typeof title === 'string' ? (
          <p className="mb-0 min-w-0 max-w-full flex-1 break-words text-h4 md:truncate">{title}</p>
        ) : (
          title != null && <div className="min-w-0 max-w-full flex-1">{title}</div>
        )}
        {actionBlock && <div className="hidden shrink-0 md:flex">{actionBlock}</div>}
        {endAdornment && <div className="flex shrink-0 items-center">{endAdornment}</div>}
      </div>
      {/* Mobile-only action row — the CTA stretched to the bar's full width. */}
      {actionBlock && <div className="flex w-full md:hidden [&>*]:w-full">{actionBlock}</div>}
    </div>
  );
}
