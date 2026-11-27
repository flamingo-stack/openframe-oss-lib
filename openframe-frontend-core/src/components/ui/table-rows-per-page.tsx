'use client';

import { useMemo } from 'react';
import { DropdownButton } from './dropdown-button';

export interface TableRowsPerPageProps {
  /** The current size, shown as "20 per page". */
  pageSize: number;
  /** The row counts the menu offers. */
  options: readonly number[];
  onChange: (pageSize: number) => void;
  /** The page is being read: the menu waits with the arrows. */
  disabled: boolean;
}

/**
 * "20 per page ⌄": the rows-per-page menu of a paged table, a quiet text menu of the row counts. `TablePagination`
 * draws it on the left of its arrows when the host can change the page size.
 */
export function TableRowsPerPage({ pageSize, options, onChange, disabled }: TableRowsPerPageProps) {
  const items = useMemo(
    () =>
      options.map(option => ({
        id: String(option),
        label: `${option} per page`,
        type: 'radio' as const,
        checked: option === pageSize,
        onClick: () => onChange(option),
      })),
    [options, pageSize, onChange],
  );

  return (
    <DropdownButton
      variant="link"
      size="wrap"
      disabled={disabled}
      ariaLabel={`Rows per page: ${pageSize}`}
      align="end"
      className="h-8 gap-[var(--spacing-system-xxs)] px-[var(--spacing-system-xxs)] text-h6"
      label={`${pageSize} per page`}
      items={items}
    />
  );
}
