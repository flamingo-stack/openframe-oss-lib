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

import { DeliveryRow } from './delivery-row';
import type { DeliveryItem } from '../../../types/delivery';

interface DeliveryTableProps {
  items: DeliveryItem[];
  isLoading?: boolean;
  /** ClickUp external_id to highlight (matches `?focus=<id>` in the
   *  URL). The matched row gets a flashing accent border so the user
   *  can tell where their linked ticket landed them. */
  focusId?: string | null;
}

/**
 * Skeleton loader for rows - matching responsive structure
 */
function SkeletonRow() {
  return (
    <div className="border-b border-ods-border last:border-b-0 p-[12px] md:p-[16px]">
      <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
        {/* Left: Title, subtitle, and description skeleton */}
        <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
          {/* Title skeleton - responsive */}
          <div className="min-h-[24px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-full"></div>
          </div>
          {/* Subtitle skeleton - 1 line */}
          <div className="min-h-[20px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-1/2"></div>
          </div>
          {/* Description skeleton - 3 lines */}
          <div className="min-h-[72px] flex items-center">
            <div className="flex-1 space-y-1">
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full"></div>
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full"></div>
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-2/3"></div>
            </div>
          </div>
        </div>

        {/* Right: Badge skeleton - two stacked badges */}
        <div className="flex-shrink-0 self-start flex flex-col gap-2">
          <div className="h-[32px] w-[100px] bg-ods-border rounded animate-pulse"></div>
          <div className="h-[32px] w-[120px] bg-ods-border rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * DeliveryTable Component
 * Displays bug fixes and enhancements with fixed-height rows
 */
export function DeliveryTable({ items, isLoading = false, focusId = null }: DeliveryTableProps) {
  // Show skeletons while loading
  if (isLoading) {
    return (
      <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
        <div className="w-full">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="bg-ods-card border border-ods-border rounded-[6px] p-[40px] text-center w-full">
        <p className="text-ods-text-secondary text-[14px] font-['DM_Sans'] font-medium">
          No tasks available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
      <div className="w-full">
        {items.map((item) => (
          <div
            key={item.id}
            className="border-b border-ods-border last:border-b-0"
          >
            <DeliveryRow
              item={item}
              id={`delivery-${item.id}`}
              highlighted={focusId === item.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
