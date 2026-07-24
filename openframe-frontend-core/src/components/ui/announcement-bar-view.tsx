'use client';

import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Mirrors `screens.md` in tailwind.config.ts (800px), which is also where the
 * ODS responsive tokens step up (ods-responsive-tokens.css). ONE breakpoint
 * for the whole bar: the `md:` variants below and the `onContentClick` guard
 * must never disagree (they did before — the guard read a stale 768px while
 * the CSS switched at 800px).
 */
const MD_QUERY = '(min-width: 800px)';

export interface AnnouncementBarViewProps {
  /**
   * Leading slot — typically an icon, at content width before the title. Size
   * it in the slot: the bar's icon runs 20px below `md` and 24px from `md` up,
   * and no ODS icon token carries that pair (`--icon-size-icon-size` is 16/24).
   */
  startAdornment?: ReactNode;
  /**
   * Bar message, always ONE line. A plain string gets the strip's text
   * treatment (`text-h6`, truncating); pass a ReactElement to own the markup
   * (e.g. bold title + inline description truncating as one unit).
   */
  title?: string | ReactElement;
  /**
   * Primary CTA, at content width after the title. Hidden below `md`, where
   * the content row becomes the tap target instead (`onContentClick`) — the
   * banner pattern's touch-first tradeoff.
   */
  actionBlock?: ReactElement;
  /** Trailing slot (e.g. a dismiss button). Outside the tap target, every breakpoint. */
  endAdornment?: ReactElement;
  /**
   * Below `md` only: fires when the content row is tapped, standing in for the
   * `actionBlock` that is CSS-hidden at that width. No-op from `md` up, where
   * the CTA is visible and owns the interaction.
   */
  onContentClick?: () => void;
  /** Extra classes for the padded content row (e.g. a cursor affordance). */
  contentClassName?: string;
  /** Surface styling (background, text color, theme scope) is the consumer's — pass it here. */
  className?: string;
  style?: CSSProperties;
}

/**
 * ============================================================================
 * DO NOT REDESIGN THIS BAR. THIS IS THE FINAL, OWNER-APPROVED DESIGN.
 * ============================================================================
 * The 44px single-line strip below is DELIBERATE and has already been
 * regressed and reverted. Read this before you touch a single class:
 *
 *   - #1542 (Michael Assraf) RESTORED this exact 44px / text-h6 / compact-CTA
 *     design after it drifted.
 *   - #1545 "redesigned" it into a 56px, text-h4, stacked-mobile bar.
 *   - #1551 REVERTED #1545's UI wholesale, back to THIS.
 *
 * Do NOT:
 *   - bump the height (min-h-11 / 44px), the text scale (text-h6), the icon
 *     size (20/24px), or the CTA size (compact),
 *   - re-introduce a stacked / multi-row / full-width-CTA mobile layout,
 *   - "match a new mockup", "improve", "modernize", or "clean up" any of it.
 *
 * This design is the source of truth. A Figma frame is NOT authorization to
 * change it. If you genuinely believe it must change, get Michael's explicit
 * written sign-off on the PR FIRST — otherwise your change WILL be reverted
 * again, exactly like #1545 was. Touch it and you own the revert.
 * ============================================================================
 *
 * Pure presentational announcement/notification bar. No data fetching,
 * storage, or navigation — consumers own state and pass content through slots.
 *
 * Anatomy follows the announcement-bar industry standard: ONE line of text at
 * 13-14px inside a 44px-tall strip (guides converge on 40-60px with a single
 * sentence; two stacked 18px rows blow past that), ONE compact CTA on the
 * right, and a trailing dismiss slot. Spacing is the ODS responsive tokens,
 * which step at the same 800px as `md`: `l` = 16/24px edge padding, `s` =
 * 8/12px gap, `m` = CTA offset, `xs` = 4/8px.
 */
export function AnnouncementBarView({
  startAdornment,
  title,
  actionBlock,
  endAdornment,
  onContentClick,
  contentClassName,
  className,
  style,
}: AnnouncementBarViewProps) {
  const handleContentClick = onContentClick
    ? () => {
        if (!window.matchMedia(MD_QUERY).matches) onContentClick();
      }
    : undefined;

  return (
    <div className={cn('flex w-full max-w-full min-h-11 items-center', className)} style={style}>
      {/* Content row — the tap target below `md`, where the CTA is hidden.
          Its vertical padding never drives the height; the 44px strip does. */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-row items-center gap-[var(--spacing-system-s)] py-[var(--spacing-system-xs)] pl-[var(--spacing-system-l)]',
          contentClassName,
        )}
        onClick={handleContentClick}
      >
        {startAdornment && <div className="flex shrink-0 items-center">{startAdornment}</div>}
        {typeof title === 'string' ? (
          <p className="mb-0 min-w-0 max-w-full flex-1 truncate text-h6">{title}</p>
        ) : (
          title != null && <div className="min-w-0 max-w-full flex-1">{title}</div>
        )}
        {/* Below `md` the CTA is visually replaced by the row-wide tap target,
            but a `display:none` button is unreachable by keyboard and AT. So
            it is only visually hidden there (`sr-only`) and reveals itself on
            focus — the row stays the touch affordance while Tab still reaches
            a real, labelled control. `md:` restores the normal inline CTA. */}
        {actionBlock && (
          <div className="ml-[var(--spacing-system-m)] sr-only shrink-0 focus-within:not-sr-only md:not-sr-only md:flex">
            {actionBlock}
          </div>
        )}
      </div>
      {/* Trailing slot. Its own 32px hit box optically re-centers the glyph
          against the 16/24px left edge. */}
      {endAdornment && (
        <div className="ml-[var(--spacing-system-xs)] mr-[var(--spacing-system-m)] shrink-0">{endAdornment}</div>
      )}
    </div>
  );
}
