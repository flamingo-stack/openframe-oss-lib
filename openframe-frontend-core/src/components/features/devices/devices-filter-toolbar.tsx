'use client';

import type { ComponentProps, Ref } from 'react';
import { cn } from '../../../utils/cn';
import { FilterModal, TagSearchInput, type TagSearchOption } from '../../ui';
import { DeviceTagsFilterButton } from './device-tags-filter-button';

type FilterModalProps = ComponentProps<typeof FilterModal>;

export interface DevicesFilterToolbarProps {
  /** Search input, current value (debounce/URL sync owned by the parent). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Already-selected tag chips rendered inside the search input. */
  tags: TagSearchOption<string>[];
  onTagRemove: (value: string) => void;
  onClearAll: () => void;

  /** Open the Device Tags modal. */
  onOpenFilterModal: () => void;

  /** FilterModal state, proxied straight through. */
  isFilterModalOpen: boolean;
  onCloseFilterModal: () => void;
  filterGroups: FilterModalProps['filterGroups'];
  onFilterChange: FilterModalProps['onFilterChange'];
  currentFilters?: FilterModalProps['currentFilters'];
  tagFilterKeys: FilterModalProps['tagFilterKeys'];
  selectedTags: FilterModalProps['selectedTags'];
  onTagsChange: FilterModalProps['onTagsChange'];
  isLoading?: boolean;
  /** The search field's prompt. Default "Search for Devices". */
  searchPlaceholder?: string;

  /**
   * When true (default), pins the toolbar at the top with the same negative-margin
   * bleed used by `DevicesPanel` (so the search row's background covers the
   * `PageLayout` padding). Pass `false` when mounting inside a container that
   * shouldn't bleed (e.g. a modal).
   */
  sticky?: boolean;

  /**
   * Attach to the pinned row so a caller can measure it, its height is what the
   * sticky table header parks below, and it CHANGES as the tag-chip row appears
   * and collapses. See `useStickyToolbar`. `DevicesPanelView` measures its toolbar itself
   * unless a host passes this ref: that host then owns the measurement and publishes
   * `--sticky-toolbar-h` itself (`useStickyToolbar`'s `containerStyle`), or the pinned
   * headers keep the desktop toolbar's 96px.
   */
  toolbarRef?: Ref<HTMLDivElement>;
}

/**
 * Search bar + "Device Tags" button + FilterModal. Pure presentation ,
 * all state (search value, modal open/close, filter options) is owned by
 * the parent. Reused by `DevicesPanel` and (eventually) `DeviceSelector`.
 */
export function DevicesFilterToolbar({
  searchValue,
  onSearchChange,
  tags,
  onTagRemove,
  onClearAll,
  onOpenFilterModal,
  isFilterModalOpen,
  onCloseFilterModal,
  filterGroups,
  onFilterChange,
  currentFilters,
  tagFilterKeys,
  selectedTags,
  onTagsChange,
  isLoading,
  searchPlaceholder = 'Search for Devices',
  sticky = true,
  toolbarRef,
}: DevicesFilterToolbarProps) {
  return (
    <>
      <div
        ref={toolbarRef}
        className={cn(
          'flex items-center gap-[var(--spacing-system-m)]',
          sticky &&
            'sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]',
        )}
      >
        <div className="min-w-0 flex-1">
          <TagSearchInput
            tags={tags}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            onTagRemove={onTagRemove}
            onClearAll={onClearAll}
            placeholder={searchPlaceholder}
            addMorePlaceholder="Add More..."
          />
        </div>
        <DeviceTagsFilterButton onClick={onOpenFilterModal} />
      </div>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={onCloseFilterModal}
        filterGroups={filterGroups}
        onFilterChange={onFilterChange}
        currentFilters={currentFilters}
        tagFilterKeys={tagFilterKeys}
        selectedTags={selectedTags}
        onTagsChange={onTagsChange}
        isLoading={isLoading}
        className="max-w-[600px]"
      />
    </>
  );
}
