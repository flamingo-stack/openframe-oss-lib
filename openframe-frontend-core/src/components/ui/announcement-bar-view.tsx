'use client';

import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface AnnouncementBarViewProps {
  /** Leading slot — typically a 24px icon. Rendered before the title. */
  startAdornment?: ReactNode;
  /**
   * Bar message. A plain string gets the mockup's text treatment (`text-h4`,
   * single line from `md` up, wrapping below); pass a ReactElement to fully
   * own the markup/typography (e.g. bold title + inline description).
   */
  title?: string | ReactElement;
  /**
   * Primary CTA. Lives in one trailing container with `endAdornment`; from
   * `md` up it keeps its content width on the right, below `md` the trailing
   * container drops to its own full-width row where the action stretches to
   * fill all space not taken by `endAdornment`.
   */
  actionBlock?: ReactElement;
  /** Trailing slot after the action (e.g. a dismiss button). Always keeps its content width. */
  endAdornment?: ReactElement;
  /** Surface styling (background, text color, theme scope) is the consumer's — pass it here. */
  className?: string;
  style?: CSSProperties;
}

/**
 * Pure presentational announcement/notification bar (Figma 9364-40603 desktop,
 * 9418-43969 tablet, 9418-44006 mobile). No data fetching, storage, or
 * navigation — consumers own state and pass content through slots.
 *
 * Layout: `md` (800px) and up is a single row — `startAdornment` + title
 * (flex-1, truncating) + trailing container (`actionBlock` + `endAdornment`)
 * at content width. Below `md` it stacks: icon + wrapping title on the first
 * row, the trailing container full-width on the second with the action
 * stretched and `endAdornment` at content width. Spacing/typography use
 * responsive ODS tokens, so paddings and font sizes track the breakpoint
 * automatically (12/24px gaps-paddings at `md`+, 8/16px below).
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
        'flex w-full flex-col gap-[var(--spacing-system-s)] px-[var(--spacing-system-l)] py-[var(--spacing-system-s)] md:flex-row md:items-center',
        className,
      )}
      style={style}
    >
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-s)]">
        {startAdornment}
        {typeof title === 'string' ? (
          <p className="min-w-0 flex-1 break-words text-h4 md:truncate">{title}</p>
        ) : (
          title != null && <div className="min-w-0 flex-1">{title}</div>
        )}
        {/* Without an action there is no second row to share — keep the
            trailing adornment inline with the title on every breakpoint. */}
        {!actionBlock && endAdornment}
      </div>
      {actionBlock && (
        <div className="flex w-full shrink-0 items-center gap-[var(--spacing-system-s)] md:w-auto">
          <div className="flex min-w-0 flex-1 md:flex-none [&>*]:w-full md:[&>*]:w-auto">{actionBlock}</div>
          {endAdornment}
        </div>
      )}
    </div>
  );
}
