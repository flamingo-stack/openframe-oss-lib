'use client'

import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useHorizontalScrollbar } from '../../../hooks/ui/use-horizontal-scrollbar'
import { cn } from '../../../utils/cn'
import { BoardColumn } from './board-column'
import { TicketCard } from './ticket-card'
import type { BoardChange, BoardColumnDef, BoardTicket } from './types'
import { useBoardCollapse } from './use-board-collapse'

export interface BoardProps {
  columns: BoardColumnDef[]
  onChange: (change: BoardChange) => void
  onLoadMore?: (columnId: string) => void
  onAddTicket?: (columnId: string) => void
  getTicketHref?: (ticketId: string) => string
  renderAssignSlot?: (ticket: BoardTicket) => React.ReactNode
  collapseStorageKey?: string
  loadMoreRootMargin?: string
  className?: string
}

export function Board({
  columns,
  onChange,
  onLoadMore,
  onAddTicket,
  getTicketHref,
  renderAssignSlot,
  collapseStorageKey,
  loadMoreRootMargin,
  className,
}: BoardProps) {
  const { collapsed, toggle } = useBoardCollapse(collapseStorageKey)

  const {
    scrollRef,
    trackRef,
    thumbRef,
    thumbRatio,
    onScroll,
    onTrackClick,
    onTrackWheel,
    onThumbPointerDown,
    onThumbPointerMove,
    onThumbPointerUp,
  } = useHorizontalScrollbar()

  const [items, setItems] = React.useState<BoardColumnDef[]>(columns)
  const isDraggingRef = React.useRef(false)

  React.useEffect(() => {
    if (!isDraggingRef.current) setItems(columns)
  }, [columns])

  const dragOriginRef = React.useRef<{ ticketId: string; fromColumnId: string } | null>(null)
  const [activeTicket, setActiveTicket] = React.useState<{ ticket: BoardTicket; columnId: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const collisionDetection = React.useCallback<CollisionDetection>((args) => {
    const pointer = pointerWithin(args)
    const intersections = pointer.length > 0 ? pointer : rectIntersection(args)

    const ticketHit = intersections.find(
      c => c.data?.droppableContainer?.data?.current?.type === 'ticket',
    )
    if (ticketHit) return [ticketHit]

    const columnHit = intersections.find(
      c => c.data?.droppableContainer?.data?.current?.type === 'column',
    )
    if (columnHit) {
      const columnId = columnHit.data?.droppableContainer?.data?.current?.columnId
      const ticketsInColumn = args.droppableContainers.filter(c => {
        const d = c.data.current as { type?: string; columnId?: string } | undefined
        return d?.type === 'ticket' && d.columnId === columnId
      })
      if (ticketsInColumn.length > 0) {
        const closest = closestCorners({ ...args, droppableContainers: ticketsInColumn })
        if (closest.length > 0) return closest
      }
      return [columnHit]
    }

    return closestCorners(args)
  }, [])

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    const located = locate(items, id)
    if (!located) return
    isDraggingRef.current = true
    dragOriginRef.current = { ticketId: id, fromColumnId: located.columnId }
    setActiveTicket({ ticket: located.ticket, columnId: located.columnId })
  }

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const overData = over.data.current as { columnId?: string; type?: string } | undefined
    const fromColumnId = locate(items, activeId)?.columnId
    const toColumnId = overData?.columnId
    if (!fromColumnId || !toColumnId || fromColumnId === toColumnId) return

    const origin = dragOriginRef.current
    const isReturnToOrigin = origin?.fromColumnId === toColumnId
    const targetCol = items.find(c => c.id === toColumnId)
    const blockedBySource =
      !isReturnToOrigin &&
      !!targetCol?.allowedFromColumns &&
      !!origin &&
      !targetCol.allowedFromColumns.includes(origin.fromColumnId)
    if ((targetCol?.dropDisabled && !isReturnToOrigin) || blockedBySource) return

    setItems(prev => {
      const fromIndex = findIndexInColumn(prev, fromColumnId, activeId)
      const toCol = prev.find(c => c.id === toColumnId)
      if (fromIndex < 0 || !toCol) return prev

      let toIndex: number
      if (overData?.type === 'column') {
        toIndex = toCol.tickets.length
      } else {
        const overIndex = toCol.tickets.findIndex(t => t.id === overId)
        if (overIndex < 0) {
          toIndex = toCol.tickets.length
        } else {
          const activeRect = active.rect.current.translated
          const overRect = over.rect
          const isBelow = !!activeRect && activeRect.top > overRect.top + overRect.height / 2
          toIndex = overIndex + (isBelow ? 1 : 0)
        }
      }

      const next = prev.map(c =>
        c.id === fromColumnId || c.id === toColumnId ? { ...c, tickets: [...c.tickets] } : c,
      )
      const nextFrom = next.find(c => c.id === fromColumnId)
      const nextTo = next.find(c => c.id === toColumnId)
      if (!nextFrom || !nextTo) return prev
      const [moved] = nextFrom.tickets.splice(fromIndex, 1)
      nextTo.tickets.splice(toIndex, 0, moved)
      return next
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const origin = dragOriginRef.current
    dragOriginRef.current = null
    setActiveTicket(null)
    isDraggingRef.current = false

    const { over } = e
    if (!over || !origin) {
      setItems(columns)
      return
    }

    const located = locate(items, origin.ticketId)
    if (!located) {
      setItems(columns)
      return
    }

    const toColumnId = located.columnId
    const isCrossColumn = origin.fromColumnId !== toColumnId
    const targetCol = items.find(c => c.id === toColumnId)
    if (
      isCrossColumn &&
      (targetCol?.dropDisabled ||
        (targetCol?.allowedFromColumns && !targetCol.allowedFromColumns.includes(origin.fromColumnId)))
    ) {
      setItems(columns)
      return
    }

    let finalIndex = located.index
    let finalColumnTickets = items.find(c => c.id === toColumnId)?.tickets ?? []

    const overData = over.data.current as { columnId?: string; type?: string } | undefined
    if (overData?.type === 'ticket') {
      const overIndex = findIndexInColumn(items, toColumnId, String(over.id))
      if (overIndex >= 0 && overIndex !== located.index) {
        finalColumnTickets = arrayMove(finalColumnTickets, located.index, overIndex)
        setItems(
          items.map(c =>
            c.id !== toColumnId ? c : { ...c, tickets: finalColumnTickets },
          ),
        )
        finalIndex = overIndex
      }
    }

    if (origin.fromColumnId === toColumnId) {
      const originIndex = findIndexInColumn(columns, origin.fromColumnId, origin.ticketId)
      if (originIndex === finalIndex) return
    }

    onChange({
      ticketId: origin.ticketId,
      fromColumnId: origin.fromColumnId,
      toColumnId,
      afterTicketId: finalColumnTickets[finalIndex - 1]?.id ?? null,
      beforeTicketId: finalColumnTickets[finalIndex + 1]?.id ?? null,
    })
  }

  const handleDragCancel = () => {
    dragOriginRef.current = null
    setActiveTicket(null)
    isDraggingRef.current = false
    setItems(columns)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={cn('flex flex-col h-full', className)}>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex flex-1 min-h-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((column, i) => {
            const prev = items[i - 1]
            const next = items[i + 1]
            const joinLeft = !!(column.system && prev?.system)
            const joinRight = !!(column.system && next?.system)
            const showGap = i > 0 && !joinLeft
            return (
              <React.Fragment key={column.id}>
                {showGap && <div aria-hidden className="w-[var(--spacing-system-mf)] shrink-0" />}
                <BoardColumn
                  column={column}
                  collapsed={!!collapsed[column.id]}
                  onToggleCollapse={() => toggle(column.id)}
                  onAddTicket={onAddTicket}
                  getTicketHref={getTicketHref}
                  renderAssignSlot={renderAssignSlot}
                  onLoadMore={onLoadMore}
                  loadMoreRootMargin={loadMoreRootMargin}
                  joinLeft={joinLeft}
                  joinRight={joinRight}
                />
              </React.Fragment>
            )
          })}
        </div>

        {thumbRatio > 0 && (
          <div
            ref={trackRef}
            onClick={onTrackClick}
            onWheel={onTrackWheel}
            className="relative h-2 mt-[var(--spacing-system-mf)] rounded-full bg-ods-border cursor-pointer shrink-0"
          >
            <div
              ref={thumbRef}
              data-scrollbar-thumb
              className="absolute top-0 h-full rounded-full bg-ods-text-secondary transition-colors"
              style={{ width: `${thumbRatio * 100}%`, cursor: 'grab' }}
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
            />
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTicket ? (
          <TicketCard ticket={activeTicket.ticket} columnId={activeTicket.columnId} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function locate(
  cols: BoardColumnDef[],
  ticketId: string,
): { ticket: BoardTicket; columnId: string; index: number } | null {
  for (const c of cols) {
    const idx = c.tickets.findIndex(t => t.id === ticketId)
    if (idx >= 0) return { ticket: c.tickets[idx], columnId: c.id, index: idx }
  }
  return null
}

function findIndexInColumn(cols: BoardColumnDef[], columnId: string, ticketId: string): number {
  return cols.find(c => c.id === columnId)?.tickets.findIndex(t => t.id === ticketId) ?? -1
}
