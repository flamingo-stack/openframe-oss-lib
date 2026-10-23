'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';
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
    <Button
      variant="cell"
      data-state={isActive ? 'active' : undefined}
      className={cn(
        // Square cell width follows the TopNavigation size (56px small /
        // 72px big) via the shell's --top-nav-cell var; 56px fallback for
        // standalone use.
        'w-[var(--top-nav-cell,3.5rem)]',
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
    </Button>
  );
}

export default HeaderButton;
