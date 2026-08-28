'use client';

import type { BookingConfirmation } from '../../schemas/meeting-booking-schema';
import { formatDurationCompact } from '../../utils/format';

/**
 * Confirmation — terminal success state after a completed booking. Renders
 * the booked instant in the visitor's resolved zone. Deliberately NO
 * follow-up CTA: the job is done, the calendar invite is the next touchpoint
 * (a "book another" button here tested as noise).
 */

export interface ConfirmationProps {
  confirmation: BookingConfirmation;
  timezone: string;
}

export function Confirmation({ confirmation, timezone }: ConfirmationProps) {
  const when = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(confirmation.startTimeMs));

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-m)] text-center">
      <p className="text-h1" role="img" aria-label="Celebration">
        🎉
      </p>
      <h3 className="text-ods-text-primary text-h3">You&apos;re booked</h3>
      <p className="text-ods-text-primary text-h5">{confirmation.title}</p>
      <p className="text-ods-text-secondary text-h6">
        {when} · {formatDurationCompact(confirmation.durationMs / 1000)}
      </p>
      <p className="text-ods-text-secondary text-h6">A calendar invite is on its way to your email.</p>
    </div>
  );
}
