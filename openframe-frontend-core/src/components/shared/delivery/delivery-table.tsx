'use client';

/**
 * DeliveryTable — bordered card containing one `<DeliveryRow />` per
 * item. Visual rendering of each row lives in `delivery-row.tsx` so the
 * exact same primitive can be composed elsewhere (notably the linked-
 * delivery surface inside `<TicketDetailDrawer>`).
 *
 * Props:
 *   - `items` — flat list of `DeliveryItem`. Two buckets (completed +
 *     in-progress) are rendered as two separate `DeliveryTable`s by
 *     the parent `DeliveryLists`.
 *   - `isLoading` — skeleton rows.
 *   - `focusId` — `?focus=<id>` URL param. Marks the matching row
 *     `id="delivery-<id>"` and applies the highlight ring so the
 *     deep-link from a ticket's linked-card scrolls + flashes the
 *     right row.
 */

import type { DeliveryItem } from '../../../types/delivery';
import { devSectionAnchorId } from '../../../utils/dev-sections/dev-section-param-keys';
import { CONTENT_CARD_SKELETON_FRAME_CLASS } from '../../chat/entity-cards/content-card-frame';
import { DeliveryRow, DeliveryRowSkeleton } from './delivery-row';

interface DeliveryTableProps {
  items: DeliveryItem[];
  isLoading?: boolean;
}

/** The card's frame and a row's separator, read by the table and by its skeleton. */
const TABLE_FRAME_CLASS = `w-full ${CONTENT_CARD_SKELETON_FRAME_CLASS}`;
const ROW_SEPARATOR_CLASS = 'border-b border-ods-border last:border-b-0';
/** How many rows the skeleton draws (the table's first fold). */
export const DELIVERY_TABLE_SKELETON_ROWS = 5;

/** The table while its tasks are read: the same card, `DELIVERY_TABLE_SKELETON_ROWS` row skeletons. */
export function DeliveryTableSkeleton() {
  return (
    <div className={TABLE_FRAME_CLASS} aria-hidden>
      <div className="w-full">
        {Array.from({ length: DELIVERY_TABLE_SKELETON_ROWS }, (_, i) => (
          <div key={i} className={ROW_SEPARATOR_CLASS}>
            <DeliveryRowSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DeliveryTable Component
 * Displays bug fixes and enhancements with fixed-height rows
 */
export function DeliveryTable({ items, isLoading = false }: DeliveryTableProps) {
  // Show skeletons while loading
  if (isLoading) return <DeliveryTableSkeleton />;

  // Empty state
  if (items.length === 0) {
    return (
      <div className={`${TABLE_FRAME_CLASS} p-[var(--spacing-system-xlf)] text-center`}>
        <p className="text-ods-text-secondary text-h6">No tasks available</p>
      </div>
    );
  }

  return (
    <div className={TABLE_FRAME_CLASS}>
      <div className="w-full">
        {items.map(item => (
          // DOM id lives on DeliveryRow's own outer element (no wrapper
          // div). Anchor mirrors `buildDevSectionUrl('delivery', <id>)`
          // → `#delivery-<external_id>`; `useScrollToHash` in
          // `delivery-lists.tsx` finds the row by id and scrolls. The
          // outer wrapper here ONLY exists for the row separators.
          <div key={item.id} className={ROW_SEPARATOR_CLASS}>
            <DeliveryRow item={item} id={devSectionAnchorId('delivery', item.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
