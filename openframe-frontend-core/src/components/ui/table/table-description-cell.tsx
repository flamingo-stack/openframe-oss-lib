'use client'

import React from 'react'
import { cn } from '../../../utils/cn'

export interface TableDescriptionCellProps {
  /**
   * The description text to display
   */
  text: string
  /**
   * Optional additional CSS classes
   */
  className?: string
  /**
   * Maximum number of lines to display before truncating
   * @default 3
   */
  maxLines?: number
}

/**
 * TableDescriptionCell
 *
 * A reusable component for displaying multi-line description text in table cells.
 * Uses ODS design tokens and supports line clamping for consistent presentation.
 *
 * @example
 * ```tsx
 * <TableDescriptionCell
 *   text="This is a long description that will wrap to multiple lines..."
 *   maxLines={3}
 * />
 * ```
 */
export function TableDescriptionCell({
  text,
  className,
  maxLines = 3
}: TableDescriptionCellProps) {
  return (
    <div className="flex-1">
      <div className="flex flex-col justify-center">
        <span
          className={cn(
            "font-['DM_Sans'] font-medium text-[16px] leading-[20px] text-ods-text-secondary break-words",
            maxLines === 1 && "truncate",
            maxLines === 2 && "line-clamp-2",
            maxLines === 3 && "line-clamp-3",
            maxLines === 4 && "line-clamp-4",
            maxLines === 5 && "line-clamp-5",
            maxLines === 6 && "line-clamp-6",
            className
          )}
        >
          {text}
        </span>
      </div>
    </div>
  )
}
