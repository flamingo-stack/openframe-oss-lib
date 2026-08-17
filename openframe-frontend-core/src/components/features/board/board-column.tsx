'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { TagIcon } from '../../icons-v2-generated/shopping/tag-icon'
import { cn } from '../../../utils/cn'
import { BoardColumnHeader } from './board-column-header'
import { tintOnDark } from './color-utils'
import { TicketCard } from './ticket-card'
import { TicketCardSkeleton } from './ticket-card-skeleton'
import { useLaneScrollAnchor } from './use-lane-scroll-anchor'
import type { BoardColumnDef, BoardTicket } from './types'

export interface BoardColumnProps {
  column: BoardColumnDef
  collapsed?: boolean
  /** Takes the id so the board can pass one stable handler to every lane. */
  onToggleCollapse: (columnId: string) => void
  onAddTicket?: (columnId: string) => void
  onArchive?: (columnId: string) => void
  getTicketHref?: (ticketId: string) => string
  renderAssignSlot?: (ticket: BoardTicket) => ReactNode
  onApprove?: (ticketId: string, requestId?: string) => void | Promise<void>
  onReject?: (ticketId: string, requestId?: string) => void | Promise<void>
  onLoadMore?: (columnId: string) => void
  loadMoreRootMargin?: string
  joinLeft?: boolean
  joinRight?: boolean
}

/** Memoized: `Board` rebuilds only the two columns a drag touches, so the
 *  untouched ones keep their object identity and can skip the render entirely.
 *  Without this, every pointer move that shifts a card re-renders all lanes. */
export const BoardColumn = memo(function BoardColumn({
  column,
  collapsed = false,
  onToggleCollapse,
  onAddTicket,
  onArchive,
  getTicketHref,
  renderAssignSlot,
  onApprove,
  onReject,
  onLoadMore,
  loadMoreRootMargin = '200px 0px',
  joinLeft = false,
  joinRight = false,
}: BoardColumnProps) {
  // The drop zone is the WHOLE lane, header included — not just the list. A
  // droppable that stops at the list leaves dead strips (the header, the
  // padding) where the pointer is over a column yet hits nothing, and there the
  // drop target has to be guessed from rect overlap, which is both wrong-looking
  // and unstable. Collapsed lanes stay out: they render no list to drop into.
  const droppableData = useMemo(() => ({ columnId: column.id, type: 'column' as const }), [column.id])
  const { setNodeRef: setLaneRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: droppableData,
    disabled: column.dropDisabled || collapsed,
  })

  // The header's own prop stays zero-arg; the id is bound here, where it is
  // already known, rather than by the board building one closure per lane.
  const handleToggleCollapse = useCallback(() => onToggleCollapse(column.id), [onToggleCollapse, column.id])

  return (
    <div
      ref={setLaneRef}
      className={cn(
        'flex h-full shrink-0 flex-col gap-[var(--spacing-system-sf)] overflow-hidden rounded-md border border-ods-border p-[var(--spacing-system-sf)]',
        'transition-[width] duration-300 ease-out',
        collapsed ? 'w-14' : 'w-[400px]',
        column.system && 'bg-ods-card',
        joinLeft && 'rounded-l-none border-l-0',
        joinRight && 'rounded-r-none',
        isOver && 'outline outline-2 -outline-offset-2 outline-ods-focus',
      )}
      style={column.system ? undefined : { backgroundColor: tintOnDark(column.color) }}
    >
      <BoardColumnHeader
        column={column}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        onAddTicket={!collapsed && onAddTicket ? () => onAddTicket(column.id) : undefined}
        onArchive={!collapsed && column.archivable && onArchive ? () => onArchive(column.id) : undefined}
      />
      {!collapsed && (
        <>
          <div aria-hidden className="-mx-[var(--spacing-system-sf)] h-px shrink-0 bg-ods-border" />
          <ColumnBody
            column={column}
            getTicketHref={getTicketHref}
            renderAssignSlot={renderAssignSlot}
            onApprove={onApprove}
            onReject={onReject}
            onLoadMore={onLoadMore}
            loadMoreRootMargin={loadMoreRootMargin}
          />
        </>
      )}
    </div>
  )
})

interface ColumnBodyProps {
  column: BoardColumnDef
  getTicketHref?: (ticketId: string) => string
  renderAssignSlot?: (ticket: BoardTicket) => ReactNode
  onApprove?: (ticketId: string, requestId?: string) => void | Promise<void>
  onReject?: (ticketId: string, requestId?: string) => void | Promise<void>
  onLoadMore?: (columnId: string) => void
  loadMoreRootMargin: string
}

function ColumnBody({
  column,
  getTicketHref,
  renderAssignSlot,
  onApprove,
  onReject,
  onLoadMore,
  loadMoreRootMargin,
}: ColumnBodyProps) {
  const ticketIds = useMemo(() => column.tickets.map(t => t.id), [column.tickets])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useLaneScrollAnchor(scrollRef, column.tickets)

  const loadMoreRef = useRef(onLoadMore)
  loadMoreRef.current = onLoadMore
  const columnIdRef = useRef(column.id)
  columnIdRef.current = column.id

  useEffect(() => {
    if (!column.hasMore || column.isLoadingMore) return
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root || !loadMoreRef.current) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          loadMoreRef.current?.(columnIdRef.current)
        }
      },
      { root, rootMargin: loadMoreRootMargin },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [column.hasMore, column.isLoadingMore, loadMoreRootMargin])

  return (
    // `overflow-anchor:none` hands scroll anchoring to `useLaneScrollAnchor`
    // wholesale. The browser's own anchoring is unusable here — it silently
    // skips transformed elements, so it works between drags and does nothing
    // during one — and leaving both on double-corrects every insertion.
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-xs)] overflow-y-auto [overflow-anchor:none]"
    >
      <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
        {column.isLoading ? (
          <SkeletonStack />
        ) : column.tickets.length === 0 ? (
          <EmptyState />
        ) : (
          column.tickets.map(t => (
            <TicketCard
              key={t.id}
              ticket={t}
              columnId={column.id}
              columnColor={column.color}
              href={getTicketHref?.(t.id)}
              renderAssignSlot={renderAssignSlot}
              onApprove={onApprove}
              onReject={onReject}
              dragDisabled={column.dragDisabled}
            />
          ))
        )}
      </SortableContext>
      {column.isLoadingMore && !column.isLoading && <TicketCardSkeleton />}
      {column.hasMore && <div ref={sentinelRef} aria-hidden className="h-1 shrink-0" />}
    </div>
  )
}

function SkeletonStack({ count = 4 }: { count?: number }) {
  // Position IS the identity here: the rows are interchangeable placeholders in
  // a fixed-length list, so the index is the correct key. Random keys remounted
  // every row whenever this re-rendered with a different `count`.
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <TicketCardSkeleton key={`skeleton-${i}`} />
      ))}
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-lf)] p-[var(--spacing-system-lf)] text-center text-ods-text-secondary">
      <TagIcon className="h-6 w-6 shrink-0" />
      <div className="flex w-full flex-col">
        <p className="text-h4">No tickets here</p>
        <p className="text-h6">Drag a ticket here or change its status to move it to this column</p>
      </div>
    </div>
  )
}
