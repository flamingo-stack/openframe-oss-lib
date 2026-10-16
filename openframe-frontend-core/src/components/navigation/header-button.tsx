'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { UnreadDot } from './unread-dot';

export interface HeaderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the button is in active/pressed state */
  isActive?: boolean;
  /** Icon to display in the button */
  icon: React.ReactNode;
  /** Render the shared `UnreadDot` at the icon's top-right (the
   *  notifications-bell treatment, promoted to the cell primitive so
   *  indicator cells never copy the dot markup). */
  showUnreadDot?: boolean;
  /**
   * - `cell` (default): a full-height cell of a top bar, as wide as the bar's
   *   `--top-nav-cell` (56px standalone).
   * - `compact`: for the grouped navigation sidebar's foot (`footerSlot`). In the
   *   56px rail it is a row's cell — the rail's width, 44px tall, the rows' hover —
   *   so the foot's icons sit like the tree's; from 140px of sidebar width, a 32px
   *   rounded icon button beside the account row. Pass a 20px icon.
   */
  size?: 'cell' | 'compact';
  /** Additional class names */
  className?: string;
}

export function HeaderButton({
  isActive = false,
  icon,
  showUnreadDot = false,
  size = 'cell',
  className,
  ...props
}: HeaderButtonProps) {
  const compact = size === 'compact';
  return (
    <button
      className={cn(
        'flex shrink-0 items-center justify-center',
        'transition-colors duration-200',
        compact
          ? cn(
              'h-11 w-full rounded-md @[140px]/of-nav-sidebar:size-8',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )
          : // Square cell width follows the TopNavigation size (56px small /
            // 72px big) via the shell's --top-nav-cell var; 56px fallback for
            // standalone use.
            'h-full w-[var(--top-nav-cell,3.5rem)]',
        isActive
          ? 'bg-ods-bg-active text-ods-text-primary'
          : // Transparent at rest so the cell inherits the bar's background
            // (TopNavigation `backgroundClassName` can differ per platform).
            cn(
              'bg-transparent text-ods-text-secondary hover:bg-ods-bg-hover',
              compact && 'hover:text-ods-text-primary disabled:hover:bg-transparent',
            ),
        className,
      )}
      {...props}
    >
      {showUnreadDot ? (
        <span className="relative inline-flex">
          {icon}
          {/* A 20px glyph takes the sidebar's fixed dot, not the bar's responsive one. */}
          <UnreadDot size={compact ? 'fixed' : 'responsive'} />
        </span>
      ) : (
        icon
      )}
    </button>
  );
}

export default HeaderButton;
