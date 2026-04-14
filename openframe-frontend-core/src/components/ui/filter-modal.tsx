'use client'

import { useEffect, useState } from 'react'

import { cn } from '../../utils/cn'
import { Filter02Icon } from '../icons-v2-generated/sort-and-filter/filter-02-icon'
import { Button } from './button'
import { FilterCheckboxItem } from './filter-checkbox-item'
import { ModalV2, ModalV2Content, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2'
import { Skeleton } from './skeleton'
import { SortColumnItem, type SortConfig, type SortDirection } from './sort-column-item'
import { TagKeyValueFilter, type TagKeyConfig } from './tag-key-value-filter'
import type { TableFilters } from './table/types'

// Re-export sub-component types for consumers
export type { SortableColumn, SortConfig, SortDirection } from './sort-column-item'
export type { TagKeyConfig, TagValueOption } from './tag-key-value-filter'

export interface FilterModalOption {
  id: string
  label: string
  count?: number
}

export interface FilterGroup {
  id: string
  title: string
  options: FilterModalOption[]
}

export interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  filterGroups: FilterGroup[]
  onFilterChange: (filters: TableFilters) => void
  currentFilters?: TableFilters
  resetButtonText?: string
  applyButtonText?: string
  className?: string
  sortConfig?: SortConfig
  onSort?: (column: string, direction: SortDirection) => void
  onSortClear?: (column: string) => void
  /** Tag key:value filter config. When provided, renders a key→value filter section */
  tagFilterKeys?: TagKeyConfig[]
  /** Currently selected tags in "key:value" format */
  selectedTags?: string[]
  /** Called when tag selection changes */
  onTagsChange?: (tags: string[]) => void
  /** Title for the tag keys section */
  tagFilterTitle?: string
  /** Show skeleton loading state */
  isLoading?: boolean
  /** Text shown in empty state title */
  emptyStateTitle?: string
  /** Text shown in empty state description */
  emptyStateDescription?: string
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
  isLoading = false,
  emptyStateTitle = 'No filters available',
  emptyStateDescription = 'There are no filter options to display at the moment',
}: FilterModalProps) {
  const [selectedFilters, setSelectedFilters] = useState<TableFilters>(() => {
    return { ...currentFilters }
  })
  const [pendingTags, setPendingTags] = useState<string[]>(selectedTags ?? [])

  useEffect(() => {
    if (isOpen) {
      setSelectedFilters({ ...currentFilters })
      setPendingTags(selectedTags ?? [])
    }
  }, [isOpen, JSON.stringify(currentFilters), JSON.stringify(selectedTags)])

  const handleFilterToggle = (groupId: string, optionId: string, checked: boolean) => {
    setSelectedFilters((prev: TableFilters) => {
      const current = prev[groupId] || []
      const updated = checked
        ? current.includes(optionId) ? current : [...current, optionId]
        : current.filter((id: string) => id !== optionId)

      if (updated.length > 0) {
        return { ...prev, [groupId]: updated }
      }
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }

  const handleReset = () => {
    onFilterChange({})
    onTagsChange?.([])
    onClose()
  }

  const handleApply = () => {
    onFilterChange(selectedFilters)
    onTagsChange?.(pendingTags)
    onClose()
  }

  const getColumnDirection = (columnKey: string): SortDirection | undefined => {
    return sortConfig?.sortBy === columnKey ? sortConfig.sortDirection : undefined
  }

  const hasSort = !!sortConfig && sortConfig.columns.length > 0
  const hasFilterGroups = filterGroups.length > 0
  const hasTagFilter = !!tagFilterKeys && tagFilterKeys.length > 0 && !!onTagsChange
  const isEmpty = !isLoading && !hasSort && !hasFilterGroups && !hasTagFilter

  return (
    <ModalV2
      isOpen={isOpen}
      onClose={onClose}
      className={cn('max-w-none max-h-[90vh]', className)}
    >
      <ModalV2Header>
        <ModalV2Title>{title}</ModalV2Title>
      </ModalV2Header>

      <ModalV2Content
        className={cn(
          'flex-1 min-h-0 flex flex-col',
          !isEmpty && 'md:bg-ods-bg md:border md:border-ods-border md:rounded-md md:px-3',
        )}
      >
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 md:py-3">
        {isLoading ? (
          <>
            {[0, 1].map((group) => (
              <div key={group} className="flex flex-col gap-1">
                <Skeleton className="h-5 w-24" />
                <div className="rounded-md border border-ods-border overflow-hidden">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="flex items-center gap-3 px-4 py-3 bg-ods-card border-b border-ods-border last:border-b-0"
                    >
                      <Skeleton className="h-6 w-6 rounded-[6px] shrink-0" />
                      <Skeleton className="h-4 flex-1 max-w-[60%]" />
                      <Skeleton className="h-4 w-10 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-6 h-[240px] p-6">
            <Filter02Icon className="text-ods-text-secondary" size={24} />
            <div className="flex flex-col items-center text-center text-ods-text-secondary">
              <p className="text-h4">
                {emptyStateTitle}
              </p>
              <p className="text-h6">
                {emptyStateDescription}
              </p>
            </div>
          </div>
        ) : (
          <>
        {/* Sort columns */}
        {sortConfig && sortConfig.columns.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-h5 text-ods-text-secondary">
              {sortConfig.title || 'Sort By'}
            </span>
            <div className="rounded-md border border-ods-border overflow-hidden">
              {sortConfig.columns.map((column) => (
                <SortColumnItem
                  key={column.key}
                  column={column}
                  currentDirection={getColumnDirection(column.key)}
                  onSort={(direction) => onSort?.(column.key, direction)}
                  onClear={onSortClear ? () => onSortClear(column.key) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filter groups */}
        {filterGroups.map((group) => {
          const groupSelection = selectedFilters[group.id] || []
          return (
            <div key={group.id} className="flex flex-col gap-1">
              <span className="text-h5 text-ods-text-secondary">
                {group.title}
              </span>
              <div className="rounded-md border border-ods-border overflow-hidden">
                {group.options.map((option) => (
                  <FilterCheckboxItem
                    key={option.id}
                    label={option.label}
                    count={option.count}
                    checked={groupSelection.includes(option.id)}
                    onChange={(checked) => handleFilterToggle(group.id, option.id, checked)}
                  />
                ))}
              </div>
            </div>
          )
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
          </>
        )}
        </div>
      </ModalV2Content>

      <ModalV2Footer>
        <Button variant="outline" className="flex-1 h-11" onClick={handleReset}>
          {resetButtonText}
        </Button>
        <Button variant="primary" className="flex-1 h-11" onClick={handleApply}>
          {applyButtonText}
        </Button>
      </ModalV2Footer>
    </ModalV2>
  )
}
