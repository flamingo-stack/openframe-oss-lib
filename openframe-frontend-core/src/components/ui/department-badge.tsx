'use client';

import type { DepartmentRef } from '../../types/department';
import { StatusBadge, type StatusBadgeProps } from './status-badge';

type BadgeColor = NonNullable<StatusBadgeProps['colorScheme']>;

// Every entry must be a VISUALLY DISTINCT colour, or two departments hash to
// badges nobody can tell apart. 'purple' was dropped for exactly that: it
// resolves to `--ods-flamingo-pink-base`, the same #f357bb as 'pink'.
const DEPARTMENT_PALETTE: ReadonlyArray<BadgeColor> = ['cyan', 'pink', 'yellow', 'green', 'warning', 'success'];

/** djb2: deterministic, so a department keeps its colour across renders, caches and SSR. */
function hashSlug(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash);
}

/** Stable badge colour per department slug: the same across headcount changes, caches and SSR. */
export function departmentColorScheme(slug: string | null | undefined): BadgeColor {
  if (!slug) return 'default';
  return DEPARTMENT_PALETTE[hashSlug(slug) % DEPARTMENT_PALETTE.length];
}

export interface DepartmentBadgeProps {
  /** A department reference; `slug` keys the colour (a name-only value renders neutral). */
  department: { name: DepartmentRef['name']; slug?: DepartmentRef['slug'] | null } | null | undefined;
  /** Text when there is no department. */
  emptyLabel?: string;
  className?: string;
  variant?: StatusBadgeProps['variant'];
}

/**
 * THE department badge: one colour per department everywhere a department is
 * shown (tables, cards, metadata cells, section headers). A department is an
 * org concept, so it lives here rather than in any one feature.
 */
export function DepartmentBadge({
  department,
  emptyLabel = 'No department',
  className,
  variant,
}: DepartmentBadgeProps) {
  if (!department?.name) {
    return <StatusBadge text={emptyLabel} colorScheme="default" singleLine variant={variant} className={className} />;
  }
  return (
    <StatusBadge
      text={department.name}
      colorScheme={departmentColorScheme(department.slug)}
      singleLine
      variant={variant}
      className={className}
    />
  );
}
