'use client';

import { cn } from '../../utils/cn';

export interface CountPillProps {
  count: number;
  className?: string;
}

/**
 * The navigation's unread count: a 24px accent pill, widening for "99+". The grouped sidebar ends its rows with it,
 * and a list row that counts the same notifications draws the same pill, so the two read alike.
 */
export function CountPill({ count, className }: CountPillProps) {
  return (
    <span
      className={cn(
        'flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xxs)]',
        className,
      )}
    >
      <span className="text-ods-text-on-accent text-h5">{count > 99 ? '99+' : count}</span>
    </span>
  );
}
