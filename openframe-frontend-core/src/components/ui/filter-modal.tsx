'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '../../utils/cn';
import { Filter02Icon } from '../icons-v2-generated/sort-and-filter/filter-02-icon';
import { Button } from './button';
import { DateFilterPanel, type DateFilterResult, type DateRange } from './date-picker';
import { FilterCheckboxItem } from './filter-checkbox-item';
import { ModalV2, ModalV2Content, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2';
import { ScrollFadeOverlay, useScrollFade } from './scroll-fade';
import { Skeleton } from './skeleton';
import { SortColumnItem, type SortConfig, type SortDirection } from './sort-column-item';
import type { TableFilters } from './table/types';
import { TagKeyValueFilter, type TagKeyConfig } from './tag-key-value-filter';

// Re-export sub-component types for consumers
export type { SortableColumn, SortConfig, SortDirection } from './sort-column-item';
export type { TagKeyConfig, TagValueOption } from './tag-key-value-filter';

export interface FilterModalOption {
  id: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  title: string;
  options: FilterModalOption[];
}

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  filterGroups: FilterGroup[];
  onFilterChange: (filters: TableFilters) => void;
  currentFilters?: TableFilters;
  resetButtonText?: string;
  applyButtonText?: string;
  className?: string;
  sortConfig?: SortConfig;
  onSort?: (column: string, direction: SortDirection) => void;
  onSortClear?: (column: string) => void;
  /** Tag key:value filter config. When provided, renders a key→value filter section */
  tagFilterKeys?: TagKeyConfig[];
  /** Currently selected tags in "key:value" format */
  selectedTags?: string[];
  /** Called when tag selection changes */
  onTagsChange?: (tags: string[]) => void;
  /** Title for the tag keys section */
  tagFilterTitle?: string;
  /** Show skeleton loading state */
  isLoading?: boolean;
  /** Date sort + range filter rendered as the last section. Drafted with the
   *  other filters and committed via `onChange` on Apply (defaults on Reset). */
  dateFilter?: {
    /** Section title. Defaults to 'Date'. */
    title?: string;
    /** Applied sort direction. Defaults to `defaultSort`. */
    sort?: SortDirection;
    /** Baseline sort direction restored by Reset. Defaults to 'desc'. */
    defaultSort?: SortDirection;
    /** Applied date range. */
    range?: DateRange;
    /** Minimum selectable date. */
    fromDate?: Date;
    /** Maximum selectable date (e.g. today, to block future dates). */
    toDate?: Date;
    /** Fired on Apply with the drafted values, and on Reset with the defaults. */
    onChange: (result: DateFilterResult) => void;
  };
  /** Text shown in empty state title */
  emptyStateTitle?: string;
  /** Text shown in empty state description */
  emptyStateDescription?: string;
}

export function FilterModal({
  isOpen,
  onClose,
  title = 'Sort and Filter',
  filterGroups,
  onFilterChange,
  currentFilters = {},
  resetButtonText = 'Reset Filters',
  applyButtonText = 'Apply Filters',
  className,
  sortConfig,
  onSort,
  onSortClear,
  tagFilterKeys,
  selectedTags,
  onTagsChange,
  tagFilterTitle,
  dateFilter,
  isLoading = false,
  emptyStateTitle = 'No filters available',
  emptyStateDescription = 'There are no filter options to display at the moment',
}: FilterModalProps) {
  const [selectedFilters, setSelectedFilters] = useState<TableFilters>(() => {
    return { ...currentFilters };
  });
  const [pendingTags, setPendingTags] = useState<string[]>(selectedTags ?? []);

  const dateDefaultSort: SortDirection = dateFilter?.defaultSort ?? 'desc';
  const [draftDateSort, setDraftDateSort] = useState<SortDirection>(dateFilter?.sort ?? dateDefaultSort);
  const [draftDateRange, setDraftDateRange] = useState<DateRange | undefined>(dateFilter?.range);

  // Scroll shadows: bottom fade by default while content continues below,
  // top fade once scrolled (same pattern as the chat lists).
  const { scrollRef, fadeTop, fadeBottom, update: updateFade } = useScrollFade<HTMLDivElement>();

  // Re-seeding the drafts is keyed on the modal opening and on the CONTENT of
  // the incoming filters — a parent that rebuilds the same objects every render
  // must not stomp what the user has picked. The keys are extracted to named
  // variables (a `JSON.stringify(...)` inline in the array is opaque to static
  // checking), and the values themselves are read at fire time through a ref so
  // the effect has no stale-closure gap and no identity dependency.
  const seedKey = `${JSON.stringify(currentFilters)}|${JSON.stringify(selectedTags ?? [])}`;
  const seedSourceRef = useRef({ currentFilters, selectedTags, dateFilter, dateDefaultSort });
  useEffect(() => {
    seedSourceRef.current = { currentFilters, selectedTags, dateFilter, dateDefaultSort };
  });

  useEffect(() => {
    if (!isOpen) return;
    const seed = seedSourceRef.current;
    setSelectedFilters({ ...seed.currentFilters });
    setPendingTags(seed.selectedTags ?? []);
    setDraftDateSort(seed.dateFilter?.sort ?? seed.dateDefaultSort);
    setDraftDateRange(seed.dateFilter?.range);
  }, [isOpen, seedKey]);

  const handleFilterToggle = (groupId: string, optionId: string, checked: boolean) => {
    setSelectedFilters((prev: TableFilters) => {
      const current = prev[groupId] || [];
      const updated = checked
        ? current.includes(optionId)
          ? current
          : [...current, optionId]
        : current.filter((id: string) => id !== optionId);

      if (updated.length > 0) {
        return { ...prev, [groupId]: updated };
      }
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  const handleReset = () => {
    onFilterChange({});
    onTagsChange?.([]);
    dateFilter?.onChange({ sort: dateDefaultSort, range: undefined });
    onClose();
  };

  const handleApply = () => {
    onFilterChange(selectedFilters);
    onTagsChange?.(pendingTags);
    dateFilter?.onChange({ sort: draftDateSort, range: draftDateRange });
    onClose();
  };

  const getColumnDirection = (columnKey: string): SortDirection | undefined => {
    return sortConfig?.sortBy === columnKey ? sortConfig.sortDirection : undefined;
  };

  const hasSort = !!sortConfig && sortConfig.columns.length > 0;
  const hasFilterGroups = filterGroups.length > 0;
  const hasTagFilter = !!tagFilterKeys && tagFilterKeys.length > 0 && !!onTagsChange;
  const isEmpty = !isLoading && !hasSort && !hasFilterGroups && !hasTagFilter && !dateFilter;

  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className={cn('max-h-[90vh] max-w-none', className)}>
      <ModalV2Header>
        <ModalV2Title>{title}</ModalV2Title>
      </ModalV2Header>

      <ModalV2Content
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          !isEmpty && 'md:rounded-md md:border md:border-ods-border md:bg-ods-bg md:px-3',
        )}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={updateFade}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:py-3"
          >
            {isLoading ? (
              <>
                {[0, 1].map(group => (
                  <div key={group} className="flex flex-col gap-1">
                    <Skeleton className="h-5 w-24" />
                    <div className="overflow-hidden rounded-md border border-ods-border">
                      {[0, 1, 2].map(row => (
                        <div
                          key={row}
                          className="flex items-center gap-3 border-b border-ods-border bg-ods-card px-4 py-3 last:border-b-0"
                        >
                          <Skeleton className="h-6 w-6 shrink-0 rounded-[6px]" />
                          <Skeleton className="h-4 max-w-[60%] flex-1" />
                          <Skeleton className="h-4 w-10 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : isEmpty ? (
              <div className="flex h-[240px] flex-col items-center justify-center gap-6 p-6">
                <Filter02Icon className="text-ods-text-secondary" size={24} />
                <div className="flex flex-col items-center text-center text-ods-text-secondary">
                  <p className="text-h4">{emptyStateTitle}</p>
                  <p className="text-h6">{emptyStateDescription}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Sort columns */}
                {sortConfig && sortConfig.columns.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-ods-text-secondary text-h5">{sortConfig.title || 'Sort By'}</span>
                    <div className="overflow-hidden rounded-md border border-ods-border">
                      {sortConfig.columns.map(column => (
                        <SortColumnItem
                          key={column.key}
                          column={column}
                          currentDirection={getColumnDirection(column.key)}
                          onSort={direction => onSort?.(column.key, direction)}
                          onClear={onSortClear ? () => onSortClear(column.key) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter groups. A group with no options is skipped, not drawn as an
            empty box: same rule the column funnels follow — a control that
            cannot be used is worse than no control. */}
                {filterGroups.map(group => {
                  if (group.options.length === 0) return null;
                  const groupSelection = selectedFilters[group.id] || [];
                  return (
                    <div key={group.id} className="flex flex-col gap-1">
                      <span className="text-ods-text-secondary text-h5">{group.title}</span>
                      <div className="overflow-hidden rounded-md border border-ods-border">
                        {group.options.map(option => (
                          <FilterCheckboxItem
                            key={option.id}
                            label={option.label}
                            count={option.count}
                            checked={groupSelection.includes(option.id)}
                            onChange={checked => handleFilterToggle(group.id, option.id, checked)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Tag key:value filter */}
                {tagFilterKeys && tagFilterKeys.length > 0 && onTagsChange && (
                  <TagKeyValueFilter
                    keys={tagFilterKeys}
                    selectedTags={pendingTags}
                    onTagsChange={setPendingTags}
                    keysTitle={tagFilterTitle}
                  />
                )}
                {/* Date sort + range filter */}
                {dateFilter && (
                  <div className="flex flex-col gap-1">
                    <span className="text-ods-text-secondary text-h5">{dateFilter.title ?? 'Date'}</span>
                    <DateFilterPanel
                      mode="range"
                      sort={draftDateSort}
                      onSortChange={setDraftDateSort}
                      selected={draftDateRange}
                      onSelect={value => setDraftDateRange(value as DateRange | undefined)}
                      fromDate={dateFilter.fromDate}
                      toDate={dateFilter.toDate}
                      className="gap-[var(--spacing-system-xxs)]"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scroll shadows over the filter list edges */}
          <ScrollFadeOverlay edge="top" visible={fadeTop} />
          <ScrollFadeOverlay edge="bottom" visible={fadeBottom} />
        </div>
      </ModalV2Content>

      <ModalV2Footer>
        <Button variant="outline" className="h-11 flex-1" onClick={handleReset}>
          {resetButtonText}
        </Button>
        <Button variant="accent" className="h-11 flex-1" onClick={handleApply}>
          {applyButtonText}
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}
