'use client'

import { useEffect, useRef } from 'react'
import { DataTableSkeleton } from './data-table-skeleton'

export interface DataTableInfiniteFooterProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  /** Skeleton rows shown while fetching. Default `3`. */
  skeletonRows?: number
  /** `IntersectionObserver` rootMargin. Default `'200px'`. */
  rootMargin?: string
}

/**
 * Infinite-scroll trigger for a `DataTable`. Place after `<DataTable.Body>`.
 * When the sentinel intersects the viewport, calls `onLoadMore`.
 */
export function DataTableInfiniteFooter({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  skeletonRows = 3,
  rootMargin = '200px',
}: DataTableInfiniteFooterProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) onLoadMoreRef.current()
      },
      { rootMargin },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, rootMargin])

  return (
    <>
      {isFetchingNextPage && <DataTableSkeleton rows={skeletonRows} />}
      {hasNextPage && (
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      )}
    </>
  )
}
