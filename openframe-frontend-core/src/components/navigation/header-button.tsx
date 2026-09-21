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
  /** Additional class names */
  className?: string;
}

export function HeaderButton({
  isActive = false,
  icon,
  showUnreadDot = false,
  className,
  ...props
}: HeaderButtonProps) {
  return (
    <button
      className={cn(
        'flex shrink-0 items-center justify-center',
        'transition-colors duration-200',
        // Square cell width follows the TopNavigation size (56px small /
        // 72px big) via the shell's --top-nav-cell var; 56px fallback for
        // standalone use.
        'h-full w-[var(--top-nav-cell,3.5rem)]',
        isActive
          ? 'bg-ods-bg-active text-ods-text-primary'
          : // Transparent at rest so the cell inherits the bar's background
            // (TopNavigation `backgroundClassName` can differ per platform).
            'bg-transparent text-ods-text-secondary hover:bg-ods-bg-hover',
        className,
      )}
      {...props}
    >
      {showUnreadDot ? (
        <span className="relative inline-flex">
          {icon}
          <UnreadDot />
        </span>
      ) : (
        icon
      )}
    </button>
  );
}

export default HeaderButton;
