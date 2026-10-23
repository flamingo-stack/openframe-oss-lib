'use client';

/**
 * The booking form's summary of what the visitor told the page before it (a `BookingContext`): its label, then one
 * tag per line. Read only: the visitor changes it where they gave it (the page above the form).
 *
 * With a `slot` (`BookingContextSlot`) the block keeps the space of its most lines from its first paint: a grid of
 * that many cells, one line each. Loading, every cell is a tag's skeleton; loaded, the given lines fill the cells in
 * order, and with none an empty state (the slot's `emptyText`) fills the whole space. The block is one height in all
 * three, so picking a card never moves the page. Without a slot it takes room only once it has a line.
 */
import type { ReactNode } from 'react';
import { type BookingContext, type BookingContextSlot, hasBookingContext } from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import { useLoadingScope } from '../ui/loading-scope';
import { Tag } from '../ui/tag';

/** The cells: one column on a phone, two from `content-md`. ONE class for every state. */
const SLOT_GRID_CLASS = 'grid grid-cols-1 gap-[var(--spacing-system-xs)] content-md:grid-cols-2';
/** A cell: a flex row, so a tag (or its inline skeleton) is the cell's whole height, with no line box around it. */
const SLOT_CELL_CLASS = 'flex min-w-0';
/** A line's tag: the sentence tag, never wider than its cell (a longer line clips, whole in the tag's tooltip). */
const LINE_TAG_PROPS = { variant: 'outline', size: 'sentence', className: 'max-w-full' } as const;
/** A line while loading: a typical sentence's width, not the tag skeleton's label width. */
const LOADING_LINE_CLASS = 'w-3/4';
/** The empty state, over the whole reserved space (its slots hidden under it). */
const EMPTY_CLASS =
  'absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-ods-border px-[var(--spacing-system-sf)] text-center text-ods-text-secondary text-h6';
/** A cell no line has filled yet: a dashed slot at a tag's height, so the reserved space reads as places to fill. */
const EMPTY_CELL_CLASS = 'h-9 w-full rounded-md border border-dashed border-ods-border';

export function BookingContextSummary({
  context,
  slot,
  loading: loadingProp,
}: {
  context?: BookingContext | null;
  slot?: BookingContextSlot;
  /** Draw the loading form outside a loading scope too. */
  loading?: boolean;
}) {
  const loading = useLoadingScope() || loadingProp;
  const items = hasBookingContext(context) ? context.items.filter(item => item.trim()) : [];
  const label = slot?.label ?? context?.label;
  if (!label || (!slot && items.length === 0)) return null;
  if (!slot) {
    return (
      <SummaryFrame label={label}>
        <ul className="flex flex-wrap gap-[var(--spacing-system-xs)]" aria-label={label}>
          {items.map(item => (
            <li key={item} className="min-w-0 max-w-full">
              <Tag label={item} {...LINE_TAG_PROPS} />
            </li>
          ))}
        </ul>
      </SummaryFrame>
    );
  }
  const cells = Array.from({ length: Math.max(slot.slots, items.length) }, (_, index) => items[index]);
  return (
    <SummaryFrame label={label}>
      <div className="relative">
        <ul className={SLOT_GRID_CLASS} aria-label={label}>
          {cells.map((item, index) => {
            const empty = !loading && !item;
            return (
              <li
                key={item ?? `empty-${index}`}
                className={SLOT_CELL_CLASS}
                aria-hidden={empty || undefined}
                // Each cell is an item of the list in every state, so loading and loaded count the same cells.
                data-loading-item=""
              >
                {loading ? (
                  <Tag label="" loading {...LINE_TAG_PROPS} className={LOADING_LINE_CLASS} />
                ) : item ? (
                  <Tag label={item} {...LINE_TAG_PROPS} />
                ) : (
                  // With no line at all the empty state covers every slot; with some, the rest stay as slots.
                  <span className={cn(EMPTY_CELL_CLASS, items.length === 0 && 'invisible')} />
                )}
              </li>
            );
          })}
        </ul>
        {!loading && items.length === 0 && <p className={EMPTY_CLASS}>{slot.emptyText}</p>}
      </div>
    </SummaryFrame>
  );
}

function SummaryFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xs)]">
      {/* The label is the page's copy: drawn for real while loading too. */}
      <p className="text-ods-text-secondary text-h6">{label}</p>
      {children}
    </div>
  );
}
