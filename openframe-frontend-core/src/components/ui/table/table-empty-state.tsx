'use client'

import { cn } from '../../../utils/cn'
import { SearchIcon } from '../../icons-v2-generated'
import { NoData } from '../no-data'
import type { TableEmptyStateProps } from './types'

/** @deprecated Use `DataTableEmpty` from `data-table` instead. */
export function TableEmptyState({ message, icon, action, className }: TableEmptyStateProps) {
  return (
    <NoData
      icon={icon ?? <SearchIcon />}
      title={message ?? 'No results found'}
      description={message == null ? 'Try adjusting your search or filters' : undefined}
      buttonLabel={action?.label}
      onButtonClick={action?.onClick}
      className={cn('py-[var(--spacing-system-xxl)]', className)}
    />
  )
}
