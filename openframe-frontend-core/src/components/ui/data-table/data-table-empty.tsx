'use client'

import { cn } from '../../../utils/cn'
import { SearchIcon } from '../../icons-v2-generated'
import { NoData, type NoDataProps } from '../no-data'

export interface DataTableEmptyProps extends NoDataProps {}

/**
 * Empty state shown by `DataTable.Body` when there are no rows. Renders the
 * shared `NoData` empty state, centered, defaulting to a "no search results"
 * message (search icon, "No results found", "Try adjusting your search or
 * filters"). Every field can be overridden — pass any `NoData` prop
 * (icon/title/description/actions/buttonLabel/…).
 */
export function DataTableEmpty({ className, ...props }: DataTableEmptyProps) {
  return (
    <NoData
      icon={<SearchIcon />}
      title="No results found"
      description="Try adjusting your search or filters"
      {...props}
      className={cn('py-[var(--spacing-system-xxl)]', className)}
    />
  )
}
