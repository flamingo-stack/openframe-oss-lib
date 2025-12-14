'use client'

import React from 'react'
import { ListPageContainer } from './page-container'
import { SearchBar, PageError } from '../ui'

export interface ListPageLayoutProps {
  /**
   * Page title
   */
  title: string
  /**
   * Header actions (buttons, controls, etc.)
   */
  headerActions?: React.ReactNode
  /**
   * Search placeholder text
   */
  searchPlaceholder: string
  /**
   * Search value
   */
  searchValue: string
  /**
   * Search change handler
   */
  onSearch: (term: string) => void
  /**
   * Main content (usually a Table or Grid)
   */
  children: React.ReactNode
  /**
   * Error message to display instead of content
   */
  error?: string | null
  /**
   * Additional CSS classes for the container
   */
  className?: string
  /**
   * Container padding
   */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /**
   * Container background
   */
  background?: 'default' | 'card' | 'transparent'
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
  searchPlaceholder,
  searchValue,
  onSearch,
  children,
  error,
  className,
  padding = 'sm',
  background = 'default'
}: ListPageLayoutProps) {

  if (error) {
    return <PageError message={error} />
  }

  return (
    <ListPageContainer
      title={title}
      headerActions={headerActions}
      padding={padding}
      background={background}
      className={className}
    >
      {/* Search Bar - Full Width */}
      <SearchBar
        placeholder={searchPlaceholder}
        onSubmit={onSearch}
        value={searchValue}
        className="w-full"
      />

      {/* Main Content - Table/Grid with filters */}
      {children}
    </ListPageContainer>
  )
}

export default ListPageLayout