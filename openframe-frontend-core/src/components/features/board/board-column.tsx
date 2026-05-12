'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import * as React from 'react'
import { TagIcon } from '../../icons-v2-generated/shopping/tag-icon'
import { cn } from '../../../utils/cn'
import { BoardColumnHeader } from './board-column-header'
import { tintOnDark } from './color-utils'
import { TicketCard } from './ticket-card'
import { TicketCardSkeleton } from './ticket-card-skeleton'
import type { BoardColumnDef, BoardTicket } from './types'

export interface BoardColumnProps {
  column: BoardColumnDef
  collapsed?: boolean
  onToggleCollapse: () => void
  onAddTicket?: (columnId: string) => void
  getTicketHref?: (ticketId: string) => string
  renderAssignSlot?: (ticket: BoardTicket) => React.ReactNode
  onLoadMore?: (columnId: string) => void
  loadMoreRootMargin?: string
  joinLeft?: boolean
  joinRight?: boolean
}

export function BoardColumn({
  column,
  collapsed = false,
  onToggleCollapse,
  onAddTicket,
  getTicketHref,
  renderAssignSlot,
  onLoadMore,
  loadMoreRootMargin = '200px 0px',
  joinLeft = false,
  joinRight = false,
}: BoardColumnProps) {
  return (
    <div
      className={cn(
        'flex h-full shrink-0 flex-col gap-[var(--spacing-system-sf)] overflow-hidden rounded-md border border-ods-border p-[var(--spacing-system-sf)]',
        'transition-[width] duration-300 ease-out',
        collapsed ? 'w-14' : 'w-[400px]',
        column.system && 'bg-ods-card',
        joinLeft && 'rounded-l-none border-l-0',
        joinRight && 'rounded-r-none',
      )}
      style={column.system ? undefined : { backgroundColor: tintOnDark(column.color) }}
    >
      <BoardColumnHeader
        column={column}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onAddTicket={!collapsed && onAddTicket ? () => onAddTicket(column.id) : undefined}
      />
      {!collapsed && (
        <>
          <div aria-hidden className="-mx-[var(--spacing-system-sf)] h-px shrink-0 bg-ods-border" />
          <ColumnBody
            column={column}
            getTicketHref={getTicketHref}
            renderAssignSlot={renderAssignSlot}
            onLoadMore={onLoadMore}
            loadMoreRootMargin={loadMoreRootMargin}
          />
        </>
      )}
    </div>
  )
}

interface ColumnBodyProps {
  column: BoardColumnDef
  getTicketHref?: (ticketId: string) => string
  renderAssignSlot?: (ticket: BoardTicket) => React.ReactNode
  onLoadMore?: (columnId: string) => void
  loadMoreRootMargin: string
}

function ColumnBody({ column, getTicketHref, renderAssignSlot, onLoadMore, loadMoreRootMargin }: ColumnBodyProps) {
  const ticketIds = React.useMemo(() => column.tickets.map(t => t.id), [column.tickets])

  const droppableData = React.useMemo(
    () => ({ columnId: column.id, type: 'column' as const }),
    [column.id],
  )
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: droppableData,
    disabled: column.dropDisabled,
  })

  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  const loadMoreRef = React.useRef(onLoadMore)
  loadMoreRef.current = onLoadMore
  const columnIdRef = React.useRef(column.id)
  columnIdRef.current = column.id

  React.useEffect(() => {
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

  const setBodyRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el
      setDroppableRef(el)
    },
    [setDroppableRef],
  )

  return (
    <div
      ref={setBodyRef}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-xs)] overflow-y-auto',
        isOver && 'rounded-md outline outline-2 outline-offset-2 outline-ods-focus',
      )}
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
              href={getTicketHref?.(t.id)}
              renderAssignSlot={renderAssignSlot}
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
  const keys = React.useMemo(
    () => Array.from({ length: count }, () => Math.random().toString(36).slice(2)),
    [count],
  )
  return (
    <>
      {keys.map(k => (
        <TicketCardSkeleton key={k} />
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
