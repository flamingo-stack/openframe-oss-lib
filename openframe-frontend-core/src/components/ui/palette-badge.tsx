'use client';

import { isBadgePaletteKey } from '../../utils/badge-palette';
import { StatusBadge, type StatusBadgeProps } from './status-badge';

export interface PaletteBadgeProps {
  text: string;
  /**
   * A `BADGE_PALETTE` key. Anything else (unknown, missing, a hex) renders the
   * standard unfilled `default` badge: colours come only from the ODS palette.
   */
  color?: string | null;
  className?: string;
  /** Defaults to the dense `button` stamp, the size every inline badge beside it uses. */
  variant?: StatusBadgeProps['variant'];
}

/**
 * THE badge for anything that carries its own colour as data (a department). It
 * is the standard `StatusBadge` in one of the ODS palette colour schemes, so it
 * matches the size, weight, casing and height of every other badge and uses ODS
 * tokens only.
 */
export function PaletteBadge({ text, color, className, variant = 'button' }: PaletteBadgeProps) {
  return (
    <StatusBadge
      text={text}
      colorScheme={isBadgePaletteKey(color) ? color : 'default'}
      variant={variant}
      singleLine
      className={className}
    />
  );
}
