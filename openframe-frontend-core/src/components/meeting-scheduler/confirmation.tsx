'use client'

import { Button } from '../ui'
import { formatDurationCompact } from '../../utils/format'
import type { BookingConfirmation } from '../../schemas/meeting-booking-schema'

/**
 * Confirmation — ODS success card after a completed booking. Renders the
 * booked instant in the visitor's resolved zone and offers a "book another"
 * reset back into the state machine.
 */

export interface ConfirmationProps {
  confirmation: BookingConfirmation
  timezone: string
  onBookAnother: () => void
}

export function Confirmation({ confirmation, timezone, onBookAnother }: ConfirmationProps) {
  const when = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(confirmation.startTimeMs))

  return (
    <div className="flex flex-col items-center gap-[var(--spacing-system-md)] border border-ods-border rounded-md bg-ods-card p-[var(--spacing-system-xl)] text-center">
      <h3 className="text-h3 text-ods-text-primary">You&apos;re booked</h3>
      <p className="text-h5 text-ods-text-primary">{confirmation.title}</p>
      <p className="text-h6 text-ods-text-secondary">
        {when} · {formatDurationCompact(confirmation.durationMs / 1000)}
      </p>
      <p className="text-h6 text-ods-text-secondary">
        A calendar invite is on its way to your email.
      </p>
      <Button variant="outline" onClick={onBookAnother}>
        Book another time
      </Button>
    </div>
  )
}
