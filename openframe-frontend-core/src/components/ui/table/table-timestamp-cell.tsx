'use client'

import React from 'react'
import { cn } from '../../../utils/cn'

/** @deprecated Use `data-table` instead. */
export interface TableTimestampCellProps {
  /**
   * The timestamp to display (can be a Date, ISO string, or formatted string)
   */
  timestamp: string | Date
  /**
   * The ID to display below the timestamp
   */
  id: string
  /**
   * Optional label for the ID (e.g., "Log ID", "Chat ID")
   * If not provided, just shows the ID
   */
  idLabel?: string
  /**
   * Optional additional CSS classes for the container
   */
  className?: string
  /**
   * Format the timestamp automatically if it's an ISO string or Date
   * @default true
   */
  formatTimestamp?: boolean
}

/**
 * Formats a timestamp for display
 * If already formatted (contains space or comma), returns as-is
 * Otherwise formats as locale string
 */
function formatTimestampValue(timestamp: string | Date): string {
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString()
  }

  // If it looks like an ISO string, format it
  if (typeof timestamp === 'string') {
    // Check if already formatted (contains typical formatting chars)
    if (timestamp.includes(',') || (timestamp.includes('/') && timestamp.includes(':'))) {
      return timestamp
    }

    // Try to parse and format ISO strings
    const date = new Date(timestamp)
    if (!isNaN(date.getTime())) {
      return date.toLocaleString()
    }
  }

  // Return as-is if we can't parse it
  return String(timestamp)
}

/** @deprecated Use `data-table` instead. */
export function TableTimestampCell({
  timestamp,
  id,
  idLabel,
  className,
  formatTimestamp = true
}: TableTimestampCellProps) {
  const displayTimestamp = formatTimestamp
    ? formatTimestampValue(timestamp)
    : String(timestamp)

  return (
    <div className={cn("flex flex-col justify-center shrink-0", className)}>
      <span className="text-h4 text-ods-text-primary truncate">
        {displayTimestamp}
      </span>
      <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate">
        {idLabel ? `${idLabel}: ${id}` : id}
      </span>
    </div>
  )
}
