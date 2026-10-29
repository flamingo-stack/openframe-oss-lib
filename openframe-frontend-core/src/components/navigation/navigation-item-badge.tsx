'use client';

import { cn } from '../../utils/cn';
import { Tag } from '../ui/tag';

export interface NavigationItemBadgeProps {
  label: string;
  /**
   * The chip at the badge scale — `h-5`, the word at `text-badge` — for the
   * mobile burger card. The card is a 40px `text-h6` row in a two-column grid,
   * and the default 32px chip stretches its grid row 16px past its neighbours.
   * The sidebar row is 56px and takes the default chip, the same one Settings
   * stamps "Beta" with.
   */
  compact?: boolean;
  className?: string;
  'aria-hidden'?: boolean;
}

/**
 * The stamp a navigation entry carries after its label
 * (`NavigationSidebarItem.badge`): the `warning` `Tag`, the same chip Settings
 * stamps "Beta" with, on the two surfaces that draw an entry with its label —
 * the expanded sidebar row and the mobile burger card. The minimized rail draws
 * none; there the row's tooltip and accessible name carry the word.
 */
export function NavigationItemBadge({ label, compact = false, className, ...rest }: NavigationItemBadgeProps) {
  // `pointer-events-none`: the chip's hover shade is for chips you act on. In a
  // nav row the row is the target, and the cursor passes through to it.
  return (
    <Tag
      as="span"
      label={label}
      variant="warning"
      className={cn('pointer-events-none shrink-0', compact && 'h-5 px-[var(--spacing-system-xxs)]', className)}
      labelClassName={compact ? 'text-badge' : undefined}
      {...rest}
    />
  );
}
