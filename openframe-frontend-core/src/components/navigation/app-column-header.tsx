'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Chevron02LeftIcon, Collapse02Icon, Expand01Icon, XmarkIcon } from '../icons-v2-generated';
import type { ColumnBack } from '../layout/column-back-slot';
import { HeaderButton } from './header-button';
import {
  COLUMN_HEADER_BACK_CELL,
  COLUMN_HEADER_CELL,
  SQUEEZED_HIDDEN,
  SQUEEZED_KEPT_CELL,
  SQUEEZED_STICKY_HEADER,
} from './work-area-squeeze';

/**
 * What the layout button of a column header does:
 * - `fullscreen`: the column takes the whole work area (the other one is hidden);
 * - `restore-split`: the hidden column comes back beside this one.
 *
 * Full screen draws the outward corners (`expand-01`), restore split the inward ones
 * (ODS `collapse-02`, Figma open-design-system 143:1075).
 */
export type AppColumnHeaderLayoutAction = 'fullscreen' | 'restore-split';

export interface AppColumnHeaderProps {
  /** The column's title (a chat's name, a page's name). Truncated to one line. */
  title: ReactNode;
  /**
   * The page's Back (`useColumnBack()`): the header's first cell, as big as the close cell and
   * flush with the column's start edge, the divider after it. Its label (default "Back") is
   * its accessible name and tooltip. Kept while the column is squeezed: a page's Back is its
   * way out, not an extra.
   */
  back?: ColumnBack | null;
  /**
   * Before the title (after `back` when both are given): content of the host's own. Kept
   * while the column is squeezed.
   */
  leading?: ReactNode;
  /**
   * Cells after the title and before the layout and close buttons (an avatar, a ⋯ menu).
   * Each one draws its own `border-l border-ods-border` cell, like `HeaderButton`.
   */
  actions?: ReactNode;
  /** The layout button; omitted, none is drawn. */
  layoutAction?: AppColumnHeaderLayoutAction;
  onLayoutAction?: () => void;
  /** Accessible name of the layout button. Defaults: "Full screen" / "Show side by side". */
  layoutActionLabel?: string;
  /** Draws the close button. */
  onClose?: () => void;
  /** Accessible name of the close button. Default "Close". */
  closeLabel?: string;
  className?: string;
}

const LAYOUT_LABEL: Record<AppColumnHeaderLayoutAction, string> = {
  fullscreen: 'Full screen',
  'restore-split': 'Show side by side',
};

/**
 * The 56px header of a work-area column (`AppLayout` `chatColumn` / page column):
 * the title on the left, then a row of square cells divided by the border — the
 * host's actions, the layout button, the close button.
 */
export function AppColumnHeader({
  title,
  back,
  leading,
  actions,
  layoutAction,
  onLayoutAction,
  layoutActionLabel,
  onClose,
  closeLabel = 'Close',
  className,
}: AppColumnHeaderProps) {
  // Squeezed (the work area's divider folded the column): the title truncates, the layout and close cells
  // keep their 56px until there is no room left. The cells are the chat column header's (`COLUMN_HEADER_CELL`).
  const cellClass = cn(COLUMN_HEADER_CELL, SQUEEZED_KEPT_CELL);
  const layoutLabel = layoutAction ? (layoutActionLabel ?? LAYOUT_LABEL[layoutAction]) : undefined;
  return (
    <div
      // Chrome, not page content: `ods-viewport-layer` keeps the window's type and spacing
      // tokens when the column is a content area narrower than 720px (the split's 480px).
      className={cn(
        'ods-viewport-layer flex h-14 shrink-0 items-stretch border-b border-ods-border-panel bg-ods-panel',
        SQUEEZED_STICKY_HEADER,
        className,
      )}
      data-column-header=""
    >
      {back && (
        <HeaderButton
          className={cn(COLUMN_HEADER_BACK_CELL, SQUEEZED_KEPT_CELL)}
          icon={<Chevron02LeftIcon className="h-5 w-5" />}
          onClick={back.onClick}
          aria-label={back.label ?? 'Back'}
          title={back.label ?? 'Back'}
          data-column-back=""
        />
      )}
      {leading && (
        // Kept while squeezed and shrinking with the layout and close cells, so the three share the floor
        // instead of the Back keeping its width and folding the other two to slivers.
        <div
          className={cn(
            'flex shrink-0 items-center pl-[var(--spacing-system-sf)] [&>*]:min-w-0 [&>*]:shrink',
            SQUEEZED_KEPT_CELL,
          )}
        >
          {leading}
        </div>
      )}
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center pr-[var(--spacing-system-sf)]',
          leading ? 'pl-[var(--spacing-system-xsf)]' : 'pl-[var(--spacing-system-lf)]',
        )}
      >
        <span className="min-w-0 truncate text-ods-text-primary text-shell-body">{title}</span>
      </div>
      {actions && <div className={cn('flex shrink-0 items-stretch', SQUEEZED_HIDDEN)}>{actions}</div>}
      {layoutAction && (
        <HeaderButton
          className={cellClass}
          icon={
            layoutAction === 'restore-split' ? (
              <Collapse02Icon className="h-5 w-5" />
            ) : (
              <Expand01Icon className="h-5 w-5" />
            )
          }
          onClick={onLayoutAction}
          aria-label={layoutLabel}
          title={layoutLabel}
        />
      )}
      {onClose && (
        <HeaderButton
          className={cellClass}
          icon={<XmarkIcon className="h-5 w-5" />}
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        />
      )}
    </div>
  );
}
