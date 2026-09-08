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
import { DeliveryRow } from './delivery-row';

interface DeliveryTableProps {
  items: DeliveryItem[];
  isLoading?: boolean;
}

/**
 * Skeleton loader for rows - matching responsive structure
 */
function SkeletonRow() {
  return (
    <div className="border-b border-ods-border p-[12px] last:border-b-0 md:p-[16px]">
      <div className="flex w-full flex-col items-start justify-between gap-[12px] md:flex-row md:gap-[16px]">
        {/* Left: Title, subtitle, and description skeleton */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-[12px] md:w-auto md:gap-[16px]">
          {/* Title skeleton - responsive */}
          <div className="flex min-h-[24px] items-center">
            <div className="h-[20px] w-full animate-pulse rounded bg-ods-border"></div>
          </div>
          {/* Subtitle skeleton - 1 line */}
          <div className="flex min-h-[20px] items-center">
            <div className="h-[20px] w-1/2 animate-pulse rounded bg-ods-border"></div>
          </div>
          {/* Description skeleton - 3 lines */}
          <div className="flex min-h-[72px] items-center">
            <div className="flex-1 space-y-1">
              <div className="h-[20px] w-full animate-pulse rounded bg-ods-border"></div>
              <div className="h-[20px] w-full animate-pulse rounded bg-ods-border"></div>
              <div className="h-[20px] w-2/3 animate-pulse rounded bg-ods-border"></div>
            </div>
          </div>
        </div>

        {/* Right: Badge skeleton - two stacked badges */}
        <div className="flex flex-shrink-0 flex-col gap-2 self-start">
          <div className="h-[32px] w-[100px] animate-pulse rounded bg-ods-border"></div>
          <div className="h-[32px] w-[120px] animate-pulse rounded bg-ods-border"></div>
        </div>
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
  if (isLoading) {
    return (
      <div className="w-full overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
        <div className="w-full">
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="w-full rounded-[6px] border border-ods-border bg-ods-card p-[40px] text-center">
        <p className="text-ods-text-secondary text-h6">No tasks available</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      <div className="w-full">
        {items.map(item => (
          // DOM id lives on DeliveryRow's own outer element (no wrapper
          // div). Anchor mirrors `buildDevSectionUrl('delivery', <id>)`
          // → `#delivery-<external_id>`; `useScrollToHash` in
          // `delivery-lists.tsx` finds the row by id and scrolls. The
          // outer wrapper here ONLY exists for the row separators.
          <div key={item.id} className="border-b border-ods-border last:border-b-0">
            <DeliveryRow item={item} id={devSectionAnchorId('delivery', item.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
