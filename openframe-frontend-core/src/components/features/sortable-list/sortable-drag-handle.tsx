'use client';

import { cn } from '../../../utils/cn';
import { DraggerIcon } from '../../icons-v2-generated/interface/dragger-icon';
import { Button } from '../../ui/button';
import type { SortableDragHandleProps as DragHandleBindings } from './use-sortable-item';

export interface SortableGripProps {
  /** `useSortableItem().dragHandleProps` of the row this grip belongs to. */
  handleProps: DragHandleBindings;
  /** Names the row for assistive tech ("Drag Billing to reorder"). */
  label?: string;
  className?: string;
}

/**
 * THE grip of a {@link SortableList} row: the lib `Button`, so every sortable
 * list has the same handle (size, focus ring, keyboard: Arrow Up / Arrow Down
 * move the row). Render it while `dragAndDropEnabled` is true and
 * `SortableMoveButtons` otherwise:
 *
 * ```tsx
 * const { itemRef, dragHandleProps, dragAndDropEnabled } = useSortableItem();
 * {dragAndDropEnabled ? <SortableDragHandle handleProps={dragHandleProps} /> : <SortableMoveButtons … />}
 * ```
 */
export function SortableDragHandle({ handleProps, label, className }: SortableGripProps) {
  return (
    <Button
      type="button"
      variant="transparent"
      size="icon-sm"
      aria-label={label ? `Drag ${label} to reorder` : 'Drag to reorder'}
      // Spread whole, as `useSortableItem` asks: the grip's ref and its arrow keys.
      {...handleProps}
      // `touch-none`: the browser must not take the gesture for a scroll.
      className={cn('shrink-0 cursor-grab touch-none text-ods-text-secondary hover:text-ods-text-primary', className)}
      leftIcon={<DraggerIcon />}
    />
  );
}
