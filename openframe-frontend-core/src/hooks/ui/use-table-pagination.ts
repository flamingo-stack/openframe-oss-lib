'use client'

import { useMemo } from 'react'
import type { CursorPaginationProps } from '../../components/ui/cursor-pagination'

/**
 * Client-side pagination configuration
 */
export interface ClientPaginationConfig {
  type: 'client'
  currentPage: number
  totalPages: number
  itemCount: number
  itemName?: string
  onNext: () => void
  onPrevious: () => void
  showInfo?: boolean
}

/**
 * Server-side cursor pagination configuration
 */
export interface ServerPaginationConfig {
  type: 'server'
  hasNextPage: boolean
  hasLoadedBeyondFirst: boolean
  startCursor?: string | null
  endCursor?: string | null
  itemCount: number
  itemName?: string
  onNext: () => void | Promise<void>
  onReset: () => void | Promise<void>
  showInfo?: boolean
}

export type PaginationConfig = ClientPaginationConfig | ServerPaginationConfig

/**
 * Unified pagination hook that works for both client-side and server-side pagination
 *
 * @example Client-side pagination
 * ```typescript
 * const pagination = useTablePagination({
 *   type: 'client',
 *   currentPage: 1,
 *   totalPages: 10,
 *   itemCount: 20,
 *   itemName: 'scripts',
 *   onNext: () => setPage(p => p + 1),
 *   onPrevious: () => setPage(p => p - 1),
 *   onReset: () => setPage(1)
 * })
 * ```
 *
 * @example Server-side pagination
 * ```typescript
 * const pagination = useTablePagination({
 *   type: 'server',
 *   hasNextPage: pageInfo.hasNextPage,
 *   hasLoadedBeyondFirst: true,
 *   startCursor: pageInfo.startCursor,
 *   endCursor: pageInfo.endCursor,
 *   itemCount: devices.length,
 *   itemName: 'devices',
 *   onNext: fetchNextPage,
 *   onReset: fetchFirstPage
 * })
 * ```
 */
export function useTablePagination(
  config: PaginationConfig | null
): CursorPaginationProps | undefined {
  return useMemo(() => {
    if (!config) return undefined

    if (config.type === 'client') {
      // Client-side pagination: show if more than 1 page
      if (config.totalPages <= 1) return undefined

      return {
        hasNextPage: config.currentPage < config.totalPages,
        hasPreviousPage: config.currentPage > 1,
        isFirstPage: config.currentPage === 1,
        startCursor: (config.currentPage - 1).toString(),
        endCursor: config.currentPage.toString(),
        currentCount: config.itemCount,
        itemName: config.itemName || 'items',
        onNext: () => config.onNext(),
        onPrevious: () => config.onPrevious(),
        showInfo: config.showInfo ?? true
      }
    } else {
      // Server-side pagination: show if pageInfo exists
      return {
        hasNextPage: config.hasNextPage,
        hasPreviousPage: config.hasLoadedBeyondFirst,
        isFirstPage: !config.hasLoadedBeyondFirst,
        startCursor: config.startCursor,
        endCursor: config.endCursor,
        currentCount: config.itemCount,
        itemName: config.itemName || 'items',
        onNext: config.onNext,
        onPrevious: config.onReset, // Previous button goes back to first page
        showInfo: config.showInfo ?? true
      }
    }
  }, [config])
}
