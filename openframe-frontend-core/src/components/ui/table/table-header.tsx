'use client';

import { useLgUp } from '../../../hooks/ui/use-media-query';
import { cn } from '../../../utils/cn';
import { FiltersDropdown, type FilterSection } from '../../features';
import { FilterIcon } from '../../icons';
import { Arrow01DownIcon } from '../../icons-v2-generated/arrows/arrow-01-down-icon';
import { Arrow01UpIcon } from '../../icons-v2-generated/arrows/arrow-01-up-icon';
import { SwitchVrIcon } from '../../icons-v2-generated/arrows/switch-vr-icon';
import { Checkbox } from '../checkbox';
import type { TableColumn, TableHeaderProps } from './types';
import { getHideClasses } from './utils';

export function TableHeader<T = any>({
  columns,
  className,
  sortBy,
  sortDirection,
  onSort,
  filters,
  onFilterChange,
  selectable,
  allSelected,
  someSelected,
  onSelectAll,
  totalItemsCount,
  stickyHeader,
  stickyHeaderOffset,
}: TableHeaderProps<T>) {
  const getAlignment = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'justify-center';
      case 'right':
        return 'justify-end';
      default:
        return 'justify-start';
    }
  };

  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable || !onSort) return;

    const columnKey = column.sortKey || column.key;
    let newDirection: 'asc' | 'desc' = 'asc';

    if (sortBy === columnKey) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }

    onSort(columnKey, newDirection);
  };

  const getSortIcon = (column: TableColumn<T>) => {
    if (!column.sortable) return null;

    const columnKey = column.sortKey || column.key;
    const isActive = sortBy === columnKey;

    if (!isActive) {
      return <SwitchVrIcon className="w-4 h-4 text-ods-text-secondary" />;
    }

    return sortDirection === 'asc' ? (
      <Arrow01UpIcon className="w-4 h-4 text-ods-accent" />
    ) : (
      <Arrow01DownIcon className="w-4 h-4 text-ods-accent" />
    );
  };

  const isLgUp = useLgUp() ?? false;

  return (
    <div
      className={cn(
        'hidden md:flex items-center gap-4 px-4 py-3 relative h-11',
        stickyHeader && `sticky z-10 bg-ods-bg ${stickyHeaderOffset || 'top-0'}`,
        className,
      )}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className="flex items-center justify-center w-10 shrink-0">
          <Checkbox
            checked={allSelected || (someSelected && !allSelected) ? true : false}
            onCheckedChange={onSelectAll}
            className="border-ods-border"
          />
        </div>
      )}

      {columns.map(column => {
        const isActionsColumn = column.key === '__actions__';
        const filterable = column.filterable && column.filterOptions && onFilterChange;

        // Hide columns on mobile if they are not actions or filterable
        if (!isLgUp && !isActionsColumn && !filterable) {
          return null;
        }

        return (
          <div
            key={column.key}
            className={cn(
              'flex gap-2 items-center',
              isLgUp && getAlignment(column.align),
              isLgUp && (column.width || 'flex-1 min-w-0'),
              column.className,
              // Only apply hide classes if the column is not filterable or on tablet
              !(filterable && !isLgUp) && getHideClasses(column.hideAt),
              isActionsColumn && 'ml-auto',
            )}
          >
            {isActionsColumn ? (
              // Render total items count in actions column
              totalItemsCount > 0 && (
                <span className="font-medium text-[12px] leading-[16px] text-ods-text-secondary whitespace-nowrap">
                  Showing {totalItemsCount} {totalItemsCount === 1 ? 'result' : 'results'}
                </span>
              )
            ) : (
              <>
                <div
                  className={cn(
                    'flex gap-2 items-center',
                    column.sortable && 'cursor-pointer hover:text-ods-text-primary transition-colors',
                  )}
                  onClick={() => handleSort(column)}
                >
                  {column.renderHeader ? (
                    column.renderHeader()
                  ) : (
                    <>
                      <span className="font-medium text-[12px] leading-[16px] text-ods-text-secondary uppercase">
                        {column.label}
                      </span>
                      {getSortIcon(column)}
                    </>
                  )}
                </div>

                {/* Filter dropdown for columns with filterOptions */}
                {column.filterable && column.filterOptions && onFilterChange && (
                  <FiltersDropdown
                    triggerElement={
                      <div
                        className={cn(
                          'p-0.5 rounded transition-all duration-200 cursor-pointer',
                          (filters?.[column.key]?.length || 0) > 0
                            ? 'bg-ods-accent hover:bg-ods-accent/80'
                            : 'hover:bg-ods-bg-active',
                        )}
                        aria-label={`Filter by ${column.label}`}
                      >
                        <FilterIcon
                          className={cn(
                            'w-4 h-4 transition-colors',
                            (filters?.[column.key]?.length || 0) > 0
                              ? 'text-ods-text-on-accent'
                              : 'text-ods-text-secondary hover:text-ods-text-primary',
                          )}
                        />
                      </div>
                    }
                    sections={[
                      {
                        id: column.key,
                        title: column.label,
                        type: 'checkbox',
                        options: column.filterOptions,
                        allowSelectAll: true,
                      } as FilterSection,
                    ]}
                    onApply={appliedFilters => {
                      onFilterChange({
                        ...filters,
                        [column.key]: appliedFilters[column.key] || [],
                      });
                    }}
                    onReset={() => {
                      const newFilters = { ...filters };
                      delete newFilters[column.key];
                      onFilterChange(newFilters);
                    }}
                    currentFilters={{ [column.key]: filters?.[column.key] || [] }}
                    placement="bottom-start"
                    dropdownClassName="min-w-[240px]"
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
