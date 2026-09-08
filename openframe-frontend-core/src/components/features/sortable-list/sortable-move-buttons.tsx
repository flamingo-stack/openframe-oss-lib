'use client';

import { useRef } from 'react';
import { cn } from '../../../utils/cn';
import { Arrow01DownIcon } from '../../icons-v2-generated/arrows/arrow-01-down-icon';
import { Arrow01UpIcon } from '../../icons-v2-generated/arrows/arrow-01-up-icon';
import { Button } from '../../ui/button';
import { useSortableListContext } from './sortable-list';

export interface SortableMoveButtonsProps {
  /** The row's current position — the caller renders the rows, so it knows. */
  index: number;
  /** How many rows the list has; the down button is disabled on the last one. */
  count: number;
  /** Names the row in the buttons' accessible labels, e.g. "On Hold". */
  label?: string;
  className?: string;
}

/**
 * The touch replacement for a drag handle: an up/down pair rendered by a row of
 * a {@link SortableList} when `dragAndDropEnabled` is `false` (see
 * `useSortableItem`). Explicit buttons because on touch nothing else survives
 * contact with the page: a drag fights scrolling, long-press fights the context
 * menu, and the HTML5 drag events behind Pragmatic never fire at all.
 *
 * Moves go through the list's `reorder`, so they hit the same `onReorder`
 * callback and the same live region as a drop or a handle's arrow keys.
 *
 * One joined pair per the design: outer corners rounded, a single hairline
 * between the halves, each half disabled at its end of the list.
 */
export function SortableMoveButtons({ index, count, label, className }: SortableMoveButtonsProps) {
  const { disabled, reorder } = useSortableListContext();
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);

  const move = (step: -1 | 1) => {
    const to = index + step;
    if (to < 0 || to >= count) return;
    reorder(index, to);
    // The row this pair sits in keeps its DOM nodes, but the pressed half may
    // come back disabled (the row reached an end) — hand focus to the other
    // half so a keyboard user is not dropped to the page body.
    requestAnimationFrame(() => {
      if (step === -1 && to === 0) downRef.current?.focus();
      if (step === 1 && to === count - 1) upRef.current?.focus();
    });
  };

  const subject = label ?? 'item';

  return (
    <div className={cn('inline-flex shrink-0', className)}>
      <Button
        ref={upRef}
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Move ${subject} up`}
        disabled={disabled || index <= 0}
        onClick={() => move(-1)}
        className="rounded-r-none border-r-0"
      >
        <Arrow01UpIcon />
      </Button>
      <Button
        ref={downRef}
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Move ${subject} down`}
        disabled={disabled || index >= count - 1}
        onClick={() => move(1)}
        className="rounded-l-none"
      >
        <Arrow01DownIcon />
      </Button>
    </div>
  );
}
