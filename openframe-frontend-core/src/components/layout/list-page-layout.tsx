'use client'

import React, { useEffect, useState } from 'react'
import { useDebounce } from '../../hooks/ui/use-debounce'
import { Filter02Icon, SearchIcon } from '../icons-v2-generated'
import { Button, Input, PageError } from '../ui'
import { MobileFilterModal, type FilterGroup, type SortConfig, type SortDirection } from '../ui/mobile-filter-sheet'
import type { TableFilters } from '../ui/table/types'
import { ListPageContainer, type PageActionButton } from './page-container'

export interface ListPageLayoutProps {
  title: string
  headerActions?: React.ReactNode
  actions?: PageActionButton[]
  searchPlaceholder: string
  searchValue: string
  onSearch: (term: string) => void
  children: React.ReactNode
  error?: string | null
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  background?: 'default' | 'card' | 'transparent'
  mobileFilterGroups?: FilterGroup[]
  onMobileFilterChange?: (filters: TableFilters) => void
  currentMobileFilters?: TableFilters
  mobileSortConfig?: SortConfig
  onMobileSort?: (column: string, direction: SortDirection) => void
  mobileFilterTitle?: string
}

/**
 * Standardized Layout for List Pages
 *
 * A comprehensive layout component that provides 100% consistent structure
 * for all list-based pages throughout the OpenFrame application.
 *
 * ## Layout Structure:
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Title (left aligned)    │    Header Actions (right aligned) │
 * ├─────────────────────────────────────────────────────────────┤
 * │                 Search Bar (full width)                    │
 * ├─────────────────────────────────────────────────────────────┤
 * │                Table/Grid with Filters                     │
 * │                    (main content)                          │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Key Features:
 * - **Consistent Spacing**: All pages use identical padding and gaps
 * - **Responsive Design**: Works seamlessly across all screen sizes
 * - **Accessibility**: Proper semantic HTML and ARIA support
 * - **Error Handling**: Built-in error state display
 * - **Flexible Actions**: Supports any combination of buttons/controls
 * - **Search Integration**: Standardized search bar positioning
 *
 * ## Currently Used By:
 * - `/devices` - Device management with table/grid toggle
 * - `/logs-page` - Log analysis with refresh functionality
 * - `/scripts` - Script management with new/refresh actions
 * - `/mingo` tabs - Archive/current chats with filtering
 * - `/policies-and-queries` tabs - Policy management with refresh/new actions
 *
 * ## Design Tokens:
 * - Uses ODS design system tokens for consistent theming
 * - Maintains proper contrast ratios and accessibility standards
 * - Supports both light and dark mode themes
 *
 * ## Performance:
 * - Minimal re-renders through proper prop drilling
 * - Optimized for large datasets with virtualization support
 * - Built-in debouncing for search operations
 *
 * @example
 * ```tsx
 * <ListPageLayout
 *   title="My Data"
 *   headerActions={<Button>Refresh</Button>}
 *   searchPlaceholder="Search items..."
 *   searchValue={searchTerm}
 *   onSearch={setSearchTerm}
 *   error={error}
 * >
 *   <Table data={items} columns={columns} />
 * </ListPageLayout>
 * ```
 */
export function ListPageLayout({
  title,
  headerActions,
  actions,
  searchPlaceholder,
  searchValue,
  onSearch,
  children,
  error,
  className,
  padding = 'sm',
  background = 'default',
  mobileFilterGroups,
  onMobileFilterChange,
  currentMobileFilters,
  mobileSortConfig,
  onMobileSort,
  mobileFilterTitle
}: ListPageLayoutProps) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [localSearchValue, setLocalSearchValue] = useState(searchValue)
  const debouncedSearchValue = useDebounce(localSearchValue, 500)

  // Sync local value when controlled value changes externally
  useEffect(() => {
    setLocalSearchValue(searchValue)
  }, [searchValue])

  // Call onSearch when debounced value changes
  useEffect(() => {
    if (debouncedSearchValue !== searchValue) {
      onSearch(debouncedSearchValue)
    }
  }, [debouncedSearchValue, onSearch, searchValue])

  // Check if mobile filter is enabled (has filter groups or sort config)
  const hasMobileFilter = (mobileFilterGroups && mobileFilterGroups.length > 0) ||
    (mobileSortConfig && mobileSortConfig.columns.length > 0)

  if (error) {
    return <PageError message={error} />
  }

  return (
    <ListPageContainer
      title={title}
      headerActions={headerActions}
      actions={actions}
      padding={padding}
      background={background}
      className={className}
    >
      {/* Search Bar with Mobile Filter Button */}
      <div className="flex gap-4 items-center w-full">
        <Input
          placeholder={searchPlaceholder}
          onChange={(e) => setLocalSearchValue(e.target.value)}
          value={localSearchValue}
          className="flex-1"
          startAdornment={<SearchIcon className="w-4 h-4 sm:w-6 sm:h-6" />}
        />

        {/* Mobile Filter Button - only visible on mobile when filter is enabled */}
        {hasMobileFilter && (
          <Button
            variant="search"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileFilterOpen(true)}
            aria-label="Open filters"
          >
            <Filter02Icon />
          </Button>
        )}
      </div>

      {/* Mobile Filter Sheet */}
      {hasMobileFilter && (
        <MobileFilterModal
          isOpen={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          title={mobileFilterTitle}
          filterGroups={mobileFilterGroups || []}
          onFilterChange={onMobileFilterChange || (() => {})}
          currentFilters={currentMobileFilters || {}}
          sortConfig={mobileSortConfig}
          onSort={onMobileSort}
        />
      )}

      {/* Main Content - Table/Grid with filters */}
      {children}
    </ListPageContainer>
  )
}

// Re-export PageActionButton type for convenience
export type { PageActionButton } from './page-container'

export default ListPageLayout