import type { ReactNode } from 'react'

export type QueryResultRow = Record<string, string | number | null>

export type QueryReportTableVariant = 'default' | 'compact'

export interface QueryReportTableProps {
  /** Dynamic title displayed above the table (e.g., query name) */
  title: string
  /** Array of result rows — columns are derived from object keys */
  data: QueryResultRow[]
  /** Show skeleton loading state */
  loading?: boolean
  /** Number of skeleton rows to display (default: 8) */
  skeletonRows?: number
  /** Number of skeleton columns to display (default: 6) */
  skeletonColumns?: number
  /** Message shown when data is empty */
  emptyMessage?: string
  /** Fixed width for each column in pixels (default: 160) */
  columnWidth?: number
  /** Explicit column ordering — keys not listed are appended at the end */
  columnOrder?: string[]
  /** Show the Export CSV button (default: true) */
  showExport?: boolean
  /** Filename for the exported CSV (default: "query-results") */
  exportFilename?: string
  /** Callback fired after CSV export (e.g., for toast notifications) */
  onExport?: () => void
  /** Additional actions rendered next to the Export button */
  headerActions?: ReactNode
  /** Visual variant: 'default' (card rows) or 'compact' (flat rows with border separators) */
  variant?: QueryReportTableVariant
  className?: string
  tableClassName?: string
}

export interface QueryReportTableHeaderProps {
  columns: string[]
  columnWidth: number
  variant?: QueryReportTableVariant
  className?: string
}

export interface QueryReportTableRowProps {
  row: QueryResultRow
  columns: string[]
  columnWidth: number
  variant?: QueryReportTableVariant
  className?: string
}

export interface QueryReportTableSkeletonProps {
  rows: number
  columns: number
  columnWidth: number
  variant?: QueryReportTableVariant
  className?: string
}
