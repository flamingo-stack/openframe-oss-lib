'use client'

import { useMemo } from 'react'
import { SquareAvatar, Button, Skeleton, Autocomplete } from '../ui'
import { ClockIcon } from '../icons-v2-generated'
import { cn } from '../../utils/cn'
import { formatDurationCompact } from '../../utils/format'
import type { MeetingHost } from '../../schemas/meeting-booking-schema'

/**
 * ContextPanel — the "who / what / how long" side of the scheduler card
 * (Calendly-anatomy left panel; stacks on top on mobile). Everything here is
 * trust surface: host identity (avatar + name + title), the meeting's own
 * title/description, the duration (chips when the link offers several — the
 * duration choice lives HERE, not as a separate wizard step), and a
 * SEARCHABLE timezone picker (all IANA zones with live GMT offsets;
 * rendering-only — the wire is always epoch-ms).
 *
 * The picker renders only once the parent resolves the zone post-mount — SSR
 * output stays deterministic; a same-footprint skeleton holds the space.
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
  onTimezoneChange?: (tz: string) => void
  /** True once a slot is chosen (details/confirmed steps) — the duration and
   *  timezone SELECTORS disappear entirely (the step summary carries both; a
   *  disabled picker next to a form just reads as noise) and a static
   *  duration line takes their place. Going Back restores them. */
  locked?: boolean
  className?: string
}

function zoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    return offset ? `${tz.replace(/_/g, ' ')} (${offset})` : tz.replace(/_/g, ' ')
  } catch {
    return tz.replace(/_/g, ' ')
  }
}

/**
 * Same-footprint skeleton — swaps with the loaded panel with zero shift.
 * STATIC labels ("Duration", "Timezone") render REAL; only data-driven
 * content (host identity, duration chips, the zone value) is skeleton.
 */
export function ContextPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-mf)]', className)}>
      <div className="flex items-center gap-[var(--spacing-system-s)]">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex flex-1 flex-col gap-[var(--spacing-system-xxs)]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <p className="text-h5 text-ods-text-secondary">Duration</p>
        <div className="flex gap-[var(--spacing-system-xs)]">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <p className="text-h5 text-ods-text-secondary">Timezone</p>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

export function SchedulerContextPanel({
  hosts,
  title,
  description,
  durationsMs,
  selectedDurationMs,
  onSelectDuration,
  timezone,
  onTimezoneChange,
  locked = false,
  className,
}: SchedulerContextPanelProps) {
  // All IANA zones with live GMT offsets — computed once, client-only (the
  // panel renders the picker only after the parent resolves a zone).
  const zoneOptions = useMemo(() => {
    if (!timezone) return []
    let zones: string[]
    try {
      // Older lib targets don't type supportedValuesOf (ES2022) — runtime-guarded.
      const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
      zones = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [timezone]
    } catch {
      zones = [timezone]
    }
    if (!zones.includes(timezone)) zones = [timezone, ...zones]
    return zones.map((tz) => ({ value: tz, label: zoneLabel(tz) }))
  }, [timezone])

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-mf)]', className)}>
      {/* Host identity: full rows up to 3 hosts; larger teams (round-robin
          links can carry many members) collapse to a stacked-avatar cluster
          + count so the panel can never overflow. */}
      {hosts.length > 0 && hosts.length <= 3 && (
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
      {hosts.length > 3 && (
        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <div className="flex items-center">
            {hosts.slice(0, 4).map((host, i) => (
              <SquareAvatar
                key={host.name}
                variant="round"
                size="lg"
                src={host.avatarUrl ?? undefined}
                alt={host.name}
                fallback={host.name}
                className={i > 0 ? '-ml-3' : undefined}
              />
            ))}
            {hosts.length > 4 && (
              <span className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ods-border bg-ods-bg text-h6 text-ods-text-secondary">
                +{hosts.length - 4}
              </span>
            )}
          </div>
          <p className="text-h6 text-ods-text-secondary">{hosts.length} hosts on this calendar</p>
        </div>
      )}

      {title && <p className="text-h3 text-ods-text-primary">{title}</p>}
      {description && <p className="text-h6 text-ods-text-secondary">{description}</p>}

      {locked ? (
        // Post-selection: selectors are GONE, not disabled — the step summary
        // owns the chosen time/zone; the panel keeps a single static line.
        selectedDurationMs != null && (
          <p className="text-h6 text-ods-text-secondary">{formatDurationCompact(selectedDurationMs / 1000)} call</p>
        )
      ) : (
        <>
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

          <div className="flex flex-col gap-[var(--spacing-system-xs)]">
            <p className="text-h5 text-ods-text-secondary">Timezone</p>
            {timezone ? (
              <Autocomplete
                value={timezone}
                onChange={(tz) => {
                  if (tz) onTimezoneChange?.(tz)
                }}
                options={zoneOptions}
                placeholder="Search timezone…"
                startAdornment={<ClockIcon className="size-4 shrink-0 text-ods-text-secondary" />}
                noOptionsText="No matching timezone"
                showClearAll={false}
              />
            ) : (
              <Skeleton className="h-12 w-full" />
            )}
          </div>
        </>
      )}
    </div>
  )
}
