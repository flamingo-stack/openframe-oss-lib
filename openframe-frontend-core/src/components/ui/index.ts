"use client"

// UI Components exports
export * from './allowed-domains-input'
export * from './autocomplete'
export * from './button'
export * from './card'
export * from './checkbox'
export * from './checkbox-block'
export * from './checkbox-with-description'
export * from './date-picker'
export * from './field-wrapper'
export * from './info-card'
export * from './info-row'
export * from './input'
export * from './interactive-card'
export * from './label'
export * from './media-type-selector'
export * from './page-loader'
export * from './progress-bar'
export * from './radio-group'
export * from './select'
export * from './switch'
export * from './tags-input'
export * from './tags-manager'
export * from './textarea'
// Layout components
export * from './alert-dialog'
export * from './aspect-ratio'
export * from './dialog'
export * from './image-gallery-modal'
export * from './modal'
export * from './modal-v2'
export * from './separator'
export * from './sheet'
export * from './drawer'
export * from './tabs'
// Navigation components
export * from './accordion'
export * from './breadcrumb'
export * from './dropdown-menu'
export * from './menubar'
export * from './navigation-menu'
export * from './tab-content'
export * from './tab-navigation'
// Animation components
export * from './pulse-dots'
// Feedback components
export * from './alert'
export * from './badge'
export * from './progress'
export * from './release-changelog-section'
export * from './status-badge'
export * from './status-indicator'
export * from './toaster'
// TODO: Add other UI components as they are moved to ui-kit
export * from './skeleton'
// Chat components
export * from '../chat'
export * from '../layout/list-page-layout'
export * from '../layout/page-container'
export * from '../layout/page-layout'
export * from '../layout/article-detail-layout'
export { ToggleGroup, ToggleGroupItem } from '../toggle-group'
export * from './actions-menu'
export * from './benefit-card'
export * from './brand-association-card'
export * from './brand-association-grid'
export * from './bullet-list'
export * from './chevron-button'
export * from './circular-progress'
export { CheckIcon, CheckCircleIcon as LucideCheckCircleIcon, XIcon as LucideXIcon, MinusIcon, XCircleIcon } from './custom-icons'
export * from './dashboard-info-card'
export * from './device-card'
export * from './device-card-compact'
export * from './feature-card'
export * from './feature-list'
export { FloatingTooltip } from './floating-tooltip'
export * from './highlight-card'
export * from './icons-block'
export * from './filter-modal'
export * from './dropdown-button'
export * from './more-actions-menu'
export * from './organization-card'
export * from './page-actions'
export * from './service-card'
export * from './slider'
export * from './square-avatar'
export * from './tab-selector'
export * from './tag'
export * from './title-content-block'
export * from './toggle'
export * from './tooltip'
export * from './error-state'
export * from './content-loader'

// Table components
export {
  Table, TableCardSkeleton, TableCell,
  TableDescriptionCell, TableEmptyState, TableHeader,
  TableRow, TableTimestampCell
} from './table'

export type {
  PagePagination, RowAction, TableCardSkeletonProps, TableCellProps, TableColumn, TableDescriptionCellProps, TableEmptyStateProps, TableHeaderProps, TableProps, TableRowProps, TableTimestampCellProps
} from './table'

// Query Report Table (dynamic columns for osquery results)
export {
  QueryReportTable, QueryReportTableHeader,
  QueryReportTableRow, QueryReportTableSkeleton,
  deriveColumns, exportToCSV
} from './query-report-table'

export type {
  QueryReportTableProps, QueryReportTableHeaderProps,
  QueryReportTableRowProps, QueryReportTableSkeletonProps,
  QueryResultRow
} from './query-report-table'

// Pagination components
export { CursorPagination, CursorPaginationSimple } from './cursor-pagination'
export type { CursorPaginationProps } from './cursor-pagination'

// DataTable (headless, TanStack Table-based) — replacement for legacy `Table`.
export * from './data-table'

// Phone input
export * from './phone-input'

// Search
export * from './search-input'
export * from './filter-checkbox-item'
export * from './filter-list'
export * from './hidden-tags-popup'
export * from './tag-search-input'
export * from './tag-key-value-filter'

// Markdown Editor (MDEditor-based)
export * from './markdown-editor'

// File Upload
export * from './file-upload'

// Ticket components
export * from './ticket-status-tag'
export * from './ticket-info-section'
export * from './ticket-detail-section'
export * from './ticket-attachments-list'
export * from './ticket-knowledge-base-list'
export * from './ticket-note-card'
export * from './ticket-notes-section'
export * from './simple-markdown-renderer'

