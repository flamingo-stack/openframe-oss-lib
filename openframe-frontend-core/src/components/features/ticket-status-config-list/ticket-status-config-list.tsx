'use client'

import {
  DndContext,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as React from 'react'
import { cn } from '../../../utils/cn'

export interface SortableRowRenderArgs {
  dragHandleProps: DraggableSyntheticListeners
  dragHandleAttributes: DraggableAttributes
  isDragging: boolean
}

export interface TicketStatusConfigListProps<T extends { id: string }> {
  items: T[]
  onReorder: (oldIndex: number, newIndex: number) => void
  renderRow: (item: T, args: SortableRowRenderArgs) => React.ReactNode
  className?: string
}

export function TicketStatusConfigList<T extends { id: string }>({
  items,
  onReorder,
  renderRow,
  className,
}: TicketStatusConfigListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(oldIndex, newIndex)
  }

  const sortableIds = React.useMemo(() => items.map(i => i.id), [items])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className={cn('flex w-full flex-col gap-[var(--spacing-system-xs)]', className)}>
          {items.map(item => (
            <SortableRow key={item.id} id={item.id}>
              {args => renderRow(item, args)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  children,
}: {
  id: string
  children: (args: SortableRowRenderArgs) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: listeners,
        dragHandleAttributes: attributes,
        isDragging,
      })}
    </div>
  )
}
