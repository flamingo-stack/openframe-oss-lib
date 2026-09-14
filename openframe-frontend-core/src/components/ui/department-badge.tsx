'use client';

import type { DepartmentRef } from '../../types/department';
import { HEX_PATTERN, getReadableTextColor } from '../../utils/ods-color-utils';
import { StatusBadge, type StatusBadgeProps } from './status-badge';

export interface DepartmentBadgeProps {
  /** A department reference. Its stored `color` fills the badge; without one it renders neutral. */
  department: { name: DepartmentRef['name']; color?: DepartmentRef['color'] } | null | undefined;
  /** Text when there is no department. */
  emptyLabel?: string;
  className?: string;
  /** Defaults to the dense `button` stamp, the size every inline badge beside it uses. */
  variant?: StatusBadgeProps['variant'];
}

/**
 * THE department badge, in the department's own colour everywhere it appears
 * (tables, cards, metadata cells, section headers).
 *
 * The colour is DATA, not code: `departments.color`, assigned at random when a
 * department is created (`randomIdentityColor`), so no department or palette is
 * listed anywhere and a new department never shares a hashed colour with an old
 * one. The label colour is picked for contrast (`getReadableTextColor`), the same
 * rule a custom ticket status uses. It is the standard `StatusBadge` stamp, so it
 * sits at the same size, weight, casing and height as the badges beside it.
 */
export function DepartmentBadge({
  department,
  emptyLabel = 'No department',
  className,
  variant = 'button',
}: DepartmentBadgeProps) {
  if (!department?.name) {
    return <StatusBadge text={emptyLabel} colorScheme="default" variant={variant} singleLine className={className} />;
  }
  const color = department.color && HEX_PATTERN.test(department.color) ? department.color : null;
  return (
    <StatusBadge
      text={department.name}
      colorScheme="default"
      variant={variant}
      singleLine
      className={className}
      style={color ? { backgroundColor: color, color: getReadableTextColor(color) } : undefined}
    />
  );
}
