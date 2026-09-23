'use client';

import { cn } from '../../utils/cn';
import { Tag } from '../ui/tag';

export interface NavigationItemBadgeProps {
  label: string;
  /**
   * The rail treatment: the word alone, in the chip's text colour, no chip. The 56px rail
   * leaves a 24px content column, and the chip around a four-letter word is
   * wider than that — it would sit over the glyph. The word at the badge scale
   * keeps the stamp readable as "Beta" instead of shrinking into a second dot
   * beside the unread one.
   */
  bare?: boolean;
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
 * (`NavigationSidebarItem.badge`). One component for the three surfaces that
 * draw an entry: the expanded sidebar row and the mobile burger card render the
 * `warning` `Tag` — the same chip Settings stamps "Beta" with; the minimized
 * rail renders it `bare`, under the icon, in the chip's text colour.
 */
export function NavigationItemBadge({
  label,
  bare = false,
  compact = false,
  className,
  ...rest
}: NavigationItemBadgeProps) {
  if (bare) {
    // `text-h5` is the stamp's family, weight and casing; `text-badge` its
    // scale. The two share one tailwind-merge group, so on one element `cn`
    // keeps only the last — hence two. The outer is a flex box so its own h5
    // line box adds no height: the word is exactly its 12px line.
    return (
      <span className={cn('flex justify-center text-ods-warning text-h5', className)} {...rest}>
        <span className="text-badge">{label}</span>
      </span>
    );
  }

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
