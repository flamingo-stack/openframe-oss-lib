'use client';

import type { DepartmentRef } from '../../types/department';
import { PaletteBadge, type PaletteBadgeProps } from './palette-badge';

export interface DepartmentBadgeProps {
  /** A department reference; its stored `color` (a palette key) fills the badge. */
  department: { name: DepartmentRef['name']; color?: DepartmentRef['color'] } | null | undefined;
  /** Text when there is no department. */
  emptyLabel?: string;
  className?: string;
  variant?: PaletteBadgeProps['variant'];
}

/**
 * THE department badge: the shared `PaletteBadge` in the department's own colour.
 * The colour is data, `departments.color`, a `BADGE_PALETTE` key picked at random
 * (`pickBadgePaletteColor`) when the department is created, so no department or
 * colour is listed in code, and every colour is an ODS token.
 */
export function DepartmentBadge({
  department,
  emptyLabel = 'No department',
  className,
  variant,
}: DepartmentBadgeProps) {
  return (
    <PaletteBadge
      text={department?.name || emptyLabel}
      color={department?.name ? department.color : null}
      className={className}
      variant={variant}
    />
  );
}
