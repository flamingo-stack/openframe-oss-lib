'use client';

import type { Column } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { FiltersDropdown, type FilterSection } from '../../features';
import { Filter02Icon } from '../../icons-v2-generated';
import {
  type DataTableFilterOption,
  type DataTableFilterSection,
  filterSectionValue,
  splitFilterSectionValues,
} from './types';
import { alignJustify } from './utils';

// Stable reference for "no filter selected" — avoids creating a new `[]` per
// render when `column.getFilterValue()` is `undefined`, which would otherwise
// invalidate `currentFilters` useMemo every render.
const EMPTY_ARRAY: string[] = [];

export interface DataTableColumnFilterProps {
  column: Column<unknown, unknown>;
  options: DataTableFilterOption[];
  /** More groups in the same dropdown: see `meta.filter.sections`. */
  extraSections?: DataTableFilterSection[];
  placement?: 'bottom-start' | 'bottom-end' | 'bottom';
  label: string;
  align?: 'left' | 'center' | 'right';
  /** Options are still loading — see `meta.filter.pending`. */
  pending?: boolean;
  /**
   * The trigger's look. `grid` is the grid layout's header cell: the label stays on one line and stays grey on hover
   * (the cell's fill is what changes), and an applied filter turns the label primary and the glyph accent.
   */
  variant?: 'cards' | 'grid';
}

/** Filter dropdown wrapper that reads/writes TanStack column filter state. */
export function DataTableColumnFilter({
  column,
  options,
  extraSections,
  placement = 'bottom-start',
  label,
  align = 'left',
  pending = false,
  variant = 'cards',
}: DataTableColumnFilterProps) {
  const currentValue = column.getFilterValue() as string[] | undefined;
  const activeCount = currentValue?.length ?? 0;

  const extraIds = useMemo(() => (extraSections ?? []).map(section => section.id), [extraSections]);

  const sections = useMemo<FilterSection[]>(
    () => [
      {
        id: column.id,
        title: label,
        type: 'checkbox',
        options,
        allowSelectAll: true,
      },
      ...(extraSections ?? [])
        .filter(section => section.options.length > 0)
        .map(section => ({
          id: section.id,
          title: section.title,
          type: 'checkbox' as const,
          options: section.options,
          allowSelectAll: true,
        })),
    ],
    [column.id, label, options, extraSections],
  );

  const currentFilters = useMemo(() => {
    if (extraIds.length === 0) return { [column.id]: currentValue ?? EMPTY_ARRAY };
    const { own, sections: picked } = splitFilterSectionValues(currentValue, extraIds);
    return { [column.id]: own, ...picked };
  }, [column.id, currentValue, extraIds]);

  const handleApply = useCallback(
    (applied: Record<string, string[]>) => {
      const next = [
        ...(applied[column.id] ?? []),
        ...extraIds.flatMap(id => (applied[id] ?? []).map(value => filterSectionValue(id, value))),
      ];
      column.setFilterValue(next.length > 0 ? next : undefined);
    },
    [column, extraIds],
  );

  const handleReset = useCallback(() => {
    column.setFilterValue(undefined);
  }, [column]);

  // Nothing to choose from. Two ways to get here, and they look different:
  //
  //  - `pending`: the options are in flight. The funnel is drawn but inert, so
  //    it does not appear out of nowhere when the query answers — the state a
  //    skeleton, or a table whose facets load separately from its rows, asks for.
  //  - otherwise: there are no options and there will be none. No funnel: a
  //    control that cannot be opened reads as a broken one, and the design shows
  //    the bare label. `meta.filter` still being declared is what keeps the
  //    header cell alive on tablet (below `lg` only filterable cells show) and
  //    keeps its 48px box — only the glyph goes.
  const isEmpty = options.length === 0;

  const applied = activeCount > 0;
  const gridTrigger = (
    <div
      className={cn(
        'flex h-12 w-full select-none items-center gap-[var(--spacing-system-xsf)]',
        alignJustify(align),
        isEmpty ? 'cursor-default' : 'cursor-pointer',
      )}
      aria-label={isEmpty ? undefined : `Filter by ${label}`}
    >
      <span className={cn('whitespace-nowrap text-h5', applied ? 'text-ods-text-primary' : 'text-ods-text-secondary')}>
        {label}
      </span>
      {(!isEmpty || pending) && (
        // The same glyph as the card header's funnel; applied, it takes the accent.
        <Filter02Icon className={cn('h-4 w-4 shrink-0', applied ? 'text-ods-accent' : 'text-ods-text-secondary')} />
      )}
    </div>
  );

  const cardsTrigger = (
    <div
      className={cn(
        // Fixed 48px per design, same as the plain header cell next to it —
        // NOT padding around the label. The two were drifting: 12px+20px+12px
        // came out 44px here while the sibling was pinned to 48, so in a
        // header mixing filterable and plain columns the labels sat on
        // different centre lines and the filter's hit area was 4px short of
        // the row it belongs to.
        'group flex h-12 w-full select-none items-center gap-[var(--spacing-system-xsf)] rounded-sm transition-colors duration-200',
        alignJustify(align),
        isEmpty ? 'cursor-default' : 'cursor-pointer',
      )}
      // Only a real control announces itself as one. With no options this box
      // is the plain header label the non-filterable columns beside it render.
      aria-label={isEmpty ? undefined : `Filter by ${label}`}
    >
      <span
        className={cn(
          'whitespace-nowrap text-ods-text-secondary transition-colors duration-200 text-h5',
          !isEmpty && 'group-hover:text-ods-text-primary',
        )}
      >
        {label}
      </span>
      {/* Kept while PENDING — it holds its own width, so the label does not
          shift sideways the moment the options resolve — and dropped once we
          know there are none. */}
      {(!isEmpty || pending) && (
        <Filter02Icon
          className={cn(
            'h-4 w-4 transition-colors',
            activeCount > 0 && 'text-ods-accent',
            activeCount === 0 && 'text-ods-text-secondary',
            activeCount === 0 && !isEmpty && 'group-hover:text-ods-text-primary',
          )}
        />
      )}
    </div>
  );

  const trigger = variant === 'grid' ? gridTrigger : cardsTrigger;

  // Same box, no dropdown: opening onto an empty list would be a worse answer
  // than not opening at all.
  if (isEmpty) {
    return <div className="block w-full">{trigger}</div>;
  }

  return (
    <FiltersDropdown
      className="!block w-full"
      triggerElement={trigger}
      sections={sections}
      currentFilters={currentFilters}
      onApply={handleApply}
      onReset={handleReset}
      placement={placement}
      dropdownClassName="min-w-60"
      // The grid header is its own clipping viewport: the panel must leave it.
      floating={variant === 'grid'}
    />
  );
}
