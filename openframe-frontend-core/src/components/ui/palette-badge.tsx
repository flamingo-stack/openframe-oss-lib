'use client';

import { colorPreset } from '../../utils/color-presets';
import { HEX_PATTERN, getReadableTextColor } from '../../utils/ods-color-utils';
import { StatusBadge, type StatusBadgeProps } from './status-badge';

export interface PaletteBadgeProps {
  text: string;
  /**
   * A `COLOR_PRESETS` key (the `neutral` key included) or a `#rrggbb` custom colour.
   * Unknown or missing renders the standard unfilled `default` badge, not the
   * `neutral` preset's fill, so an uncoloured row looks like every other plain badge.
   */
  color?: string | null;
  className?: string;
  /** Defaults to the dense `button` stamp, the size every inline badge beside it uses. */
  variant?: StatusBadgeProps['variant'];
}

/**
 * THE badge for anything that carries its own colour from the shared palette
 * (`COLOR_PRESETS`): a department, a custom ticket status, any row whose colour
 * is data. It is the standard `StatusBadge` stamp filled with the colour, with the
 * label colour picked for contrast, so it matches the size, weight, casing and
 * height of every other badge.
 */
export function PaletteBadge({ text, color, className, variant = 'button' }: PaletteBadgeProps) {
  const fill = colorPreset(color)?.color ?? (color && HEX_PATTERN.test(color) ? color : null);
  return (
    <StatusBadge
      text={text}
      colorScheme="default"
      variant={variant}
      singleLine
      className={className}
      style={fill ? { backgroundColor: fill, color: getReadableTextColor(fill) } : undefined}
    />
  );
}
