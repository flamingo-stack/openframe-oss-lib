'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Expand01Icon, XmarkIcon } from '../icons-v2-generated';
import { HeaderButton } from './header-button';

/**
 * What the layout button of a column header does:
 * - `fullscreen`: the column takes the whole work area (the other one is hidden);
 * - `restore-split`: the hidden column comes back beside this one.
 *
 * The design draws both with the same corners glyph, so they differ in their
 * accessible name (and tooltip) only.
 */
export type AppColumnHeaderLayoutAction = 'fullscreen' | 'restore-split';

export interface AppColumnHeaderProps {
  /** The column's title (a chat's name, a page's name). Truncated to one line. */
  title: ReactNode;
  /** Before the title, e.g. a Back button on a details page. */
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
  leading,
  actions,
  layoutAction,
  onLayoutAction,
  layoutActionLabel,
  onClose,
  closeLabel = 'Close',
  className,
}: AppColumnHeaderProps) {
  const cellClass = 'border-l border-ods-border';
  const layoutLabel = layoutAction ? (layoutActionLabel ?? LAYOUT_LABEL[layoutAction]) : undefined;
  return (
    <div
      // Chrome, not page content: `ods-viewport-layer` keeps the window's type and spacing
      // tokens when the column is a content area narrower than 720px (the split's 480px).
      className={cn(
        'ods-viewport-layer flex h-14 shrink-0 items-stretch border-b border-ods-border-panel bg-ods-panel',
        className,
      )}
      data-column-header=""
    >
      {leading && <div className="flex shrink-0 items-center pl-[var(--spacing-system-sf)]">{leading}</div>}
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center pr-[var(--spacing-system-sf)]',
          leading ? 'pl-[var(--spacing-system-xsf)]' : 'pl-[var(--spacing-system-lf)]',
        )}
      >
        <span className="min-w-0 truncate text-ods-text-primary text-shell-body">{title}</span>
      </div>
      {actions}
      {layoutAction && (
        <HeaderButton
          className={cellClass}
          icon={<Expand01Icon className="h-5 w-5" />}
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
