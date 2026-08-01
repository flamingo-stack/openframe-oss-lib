'use client'

import { SquareAvatar, Button } from '../ui'
import { ClockIcon } from '../icons-v2-generated'
import { cn } from '../../utils/cn'
import { formatDurationCompact } from '../../utils/format'
import type { MeetingHost } from '../../schemas/meeting-booking-schema'

/**
 * ContextPanel — the "who / what / how long" side of the scheduler card
 * (Calendly-anatomy left panel; stacks on top on mobile). Everything here is
 * trust surface: host identity (avatar + name + title), the meeting's own
 * title/description, the duration (chips when the link offers several — the
 * duration choice lives HERE, not as a separate wizard step), and the
 * visitor's resolved timezone.
 *
 * Timezone renders only once the parent resolves it post-mount — SSR output
 * stays deterministic.
 */

export interface SchedulerContextPanelProps {
  hosts: MeetingHost[]
  title?: string
  description?: string | null
  durationsMs: number[]
  selectedDurationMs: number | null
  onSelectDuration: (ms: number) => void
  /** Resolved IANA zone (null until the client resolves it). */
  timezone: string | null
  className?: string
}

export function SchedulerContextPanel({
  hosts,
  title,
  description,
  durationsMs,
  selectedDurationMs,
  onSelectDuration,
  timezone,
  className,
}: SchedulerContextPanelProps) {
  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-mf)]', className)}>
      {hosts.length > 0 && (
        <div className="flex flex-col gap-[var(--spacing-system-s)]">
          {hosts.map((host) => (
            <div key={host.name} className="flex items-center gap-[var(--spacing-system-s)]">
              <SquareAvatar variant="round" size="lg" src={host.avatarUrl ?? undefined} alt={host.name} fallback={host.name} />
              <div className="flex flex-col min-w-0">
                <p className="text-h4 text-ods-text-primary truncate">{host.name}</p>
                {host.title && <p className="text-h6 text-ods-text-secondary truncate">{host.title}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {title && <p className="text-h3 text-ods-text-primary">{title}</p>}
      {description && <p className="text-h6 text-ods-text-secondary">{description}</p>}

      {durationsMs.length > 1 ? (
        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <p className="text-h5 text-ods-text-secondary">Duration</p>
          <div className="flex flex-wrap gap-[var(--spacing-system-xs)]">
            {durationsMs.map((ms) => (
              <Button
                key={ms}
                variant={selectedDurationMs === ms ? undefined : 'outline'}
                size="small-legacy"
                onClick={() => onSelectDuration(ms)}
              >
                {formatDurationCompact(ms / 1000)}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        selectedDurationMs != null && (
          <p className="text-h6 text-ods-text-secondary">{formatDurationCompact(selectedDurationMs / 1000)} call</p>
        )
      )}

      {timezone && (
        <div className="flex items-center gap-[var(--spacing-system-xs)] text-ods-text-secondary">
          <ClockIcon className="size-4 shrink-0" />
          <p className="text-h6">Times shown in {timezone.replace(/_/g, ' ')}</p>
        </div>
      )}
    </div>
  )
}
