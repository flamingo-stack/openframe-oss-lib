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
import { LoadingItems, useLoadingScope } from '../../ui/loading-scope';
import { DeliveryRow } from './delivery-row';

interface DeliveryTableProps {
  items: DeliveryItem[];
  isLoading?: boolean;
}

/** The card's frame and a row's separator, read by the table and by its skeleton. */
const TABLE_FRAME_CLASS = `w-full ${CONTENT_CARD_SKELETON_FRAME_CLASS}`;
const ROW_SEPARATOR_CLASS = 'border-b border-ods-border last:border-b-0';
/** How many rows the skeleton draws: a typical count, since the delivery lists are read whole (no page size, no limit). */
export const DELIVERY_TABLE_SKELETON_ROWS = 5;

/** The table while its tasks are read: the same card, `DELIVERY_TABLE_SKELETON_ROWS` row skeletons. */
export function DeliveryTableSkeleton() {
  return (
    <div className={TABLE_FRAME_CLASS} aria-hidden>
      <div className="w-full">
        <LoadingItems count={DELIVERY_TABLE_SKELETON_ROWS}>
          {() => (
            <div data-loading-item className={ROW_SEPARATOR_CLASS}>
              <DeliveryRow loading />
            </div>
          )}
        </LoadingItems>
      </div>
    </div>
  );
}

/**
 * DeliveryTable Component
 * Displays bug fixes and enhancements with fixed-height rows
 */
export function DeliveryTable({ items, isLoading = false }: DeliveryTableProps) {
  // ONE switch: a page's loading scope, or the host's read.
  if (useLoadingScope() || isLoading) return <DeliveryTableSkeleton />;

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
          <div key={item.id} data-loading-item className={ROW_SEPARATOR_CLASS}>
            <DeliveryRow item={item} id={devSectionAnchorId('delivery', item.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
