'use client';

/**
 * The booking form's summary of what the visitor told the page before it (a
 * `BookingContext`): its label, then one tag per line. Read only: the visitor
 * changes it where they gave it (the page above the form). Nothing is drawn
 * without a line, so a form with no context is unchanged.
 */
import { type BookingContext, hasBookingContext } from '../../schemas/meeting-booking-schema';
import { Tag } from '../ui/tag';

export function BookingContextSummary({ context }: { context: BookingContext | null | undefined }) {
  if (!hasBookingContext(context)) return null;
  const items = context.items.filter(item => item.trim());
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xs)]">
      <p className="text-ods-text-secondary text-h6">{context.label}</p>
      <ul className="flex flex-wrap gap-[var(--spacing-system-xs)]" aria-label={context.label}>
        {items.map(item => (
          <li key={item} className="min-w-0 max-w-full">
            <Tag label={item} variant="outline" size="sentence" className="max-w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
