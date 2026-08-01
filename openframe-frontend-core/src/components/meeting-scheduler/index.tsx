'use client'

/**
 * `<HubSpotMeetingScheduler />` — natively-branded booking flow over the
 * HubSpot Meetings scheduler, rendered entirely with ODS primitives (no
 * iframe, no third-party chrome, no scripts). Data flows exclusively through
 * a HOST PROXY (`GET {apiBaseUrl}/api/meetings/availability`,
 * `POST {apiBaseUrl}/api/meetings/book`) — the widget has zero HubSpot
 * knowledge and no secrets; see `docs/EMBEDDING_HUBSPOT_MEETINGS.md` for the
 * endpoint contract a host must serve (external embedders proxy through
 * their own backend — the book route is IP-rate-limited and bot-gated).
 *
 * Two modes, one component:
 *  - SSR mode: pass `initialAvailability` (host-fetched) — the
 *    zone-independent shell (durations, form metadata, consent copy) renders
 *    server-side; slot TIME labels wait for the client zone resolution
 *    (deterministic first paint, no hydration mismatch), and availability is
 *    refetched unconditionally after mount (the seed is scaffolding for a
 *    60s-volatile resource, not truth).
 *  - Client mode: omit the seed — skeleton + self-fetch on mount.
 *
 * State machine: duration → slot → details → confirmed, with back edges, a
 * "book another" reset, auto-skip when the link offers exactly one duration,
 * and a `submitting` lock as the double-booking guard.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../utils/cn'
import { formatDurationCompact } from '../../utils/format'
import { Button, Skeleton } from '../ui'
import { useHumanitySignals } from '../../hooks/use-humanity-signals'
import { useMeetingBooking } from '../../hooks/use-meeting-booking'
import {
  isSupportedFormField,
  type BookingConfirmation,
  type MeetingAvailability,
  type MeetingBookingErrorCode,
} from '../../schemas/meeting-booking-schema'
import { SlotPicker } from './slot-picker'
import { BookingForm } from './booking-form'
import { Confirmation } from './confirmation'

export interface HubSpotMeetingSchedulerProps {
  /** Directory id of the meeting link (from the host's `/api/meetings` payload). */
  meetingId: string
  /** Endpoints prefix, default '' (same-origin `/api/meetings/*`) — FaqSection precedent. */
  apiBaseUrl?: string
  /** SSR-mode seed (host-fetched). Omitted → client mode (self-fetch on mount). */
  initialAvailability?: MeetingAvailability
  /** Pin the DISPLAY zone (rendering only — never sent upstream, never a cache key). */
  displayTimezone?: string
  /** The link's public HubSpot booking URL — the "Open in HubSpot" escape hatch target. */
  fallbackUrl?: string
  onBooked?: (b: BookingConfirmation) => void
  className?: string
}

type Step = 'duration' | 'slot' | 'details' | 'confirmed'

/**
 * Fail-closed gate: a link whose declared questions include an unsupported
 * type, or whose consent block is malformed, must NOT render a half-working
 * native form (a silently dropped required question or missing consent copy
 * is worse than no native form) — the escape hatch takes over.
 */
function isNativelyBookable(availability: MeetingAvailability): boolean {
  if (!availability.formFields.every(isSupportedFormField)) return false
  const consent = availability.legalConsent
  if (consent) {
    if (typeof consent.processingConsentText !== 'string') return false
    if (!Array.isArray(consent.communicationConsentCheckboxes)) return false
  }
  return true
}

export function HubSpotMeetingScheduler({
  meetingId,
  apiBaseUrl = '',
  initialAvailability,
  displayTimezone,
  fallbackUrl,
  onBooked,
  className,
}: HubSpotMeetingSchedulerProps) {
  const {
    availability,
    isLoadingAvailability,
    availabilityError,
    monthOffset,
    setMonthOffset,
    refetchAvailability,
    book,
    isSubmitting,
  } = useMeetingBooking({ meetingId, apiBaseUrl, initialAvailability })

  // Zone resolution happens POST-mount (Intl) unless the embedder pins one —
  // the initial (server) render stays deterministic; time labels appear once
  // a zone exists.
  const [timezone, setTimezone] = useState<string | null>(displayTimezone ?? null)
  useEffect(() => {
    if (displayTimezone) return
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    } catch {
      setTimezone('UTC')
    }
  }, [displayTimezone])

  const [step, setStep] = useState<Step>('duration')
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null)
  const [bookingError, setBookingError] = useState<MeetingBookingErrorCode | null>(null)

  const { honeypotInputProps, getSignals, resetSignals } = useHumanitySignals()

  // Reset the machine when the host switches links.
  useEffect(() => {
    setStep('duration')
    setDurationMs(null)
    setSelectedDay(null)
    setSelectedSlot(null)
    setConfirmation(null)
    setBookingError(null)
    autoAdvanceCount.current = 0
  }, [meetingId])

  const durations = availability?.durationsMs ?? []

  // Auto-skip the duration step when the link offers exactly one option.
  useEffect(() => {
    if (step === 'duration' && durations.length === 1) {
      setDurationMs(durations[0])
      setStep('slot')
    }
  }, [step, durations])

  const slots = useMemo(() => {
    if (!availability || durationMs == null) return []
    return availability.slotsByDurationMs[String(durationMs)] ?? []
  }, [availability, durationMs])

  // Fully-booked month with more ahead → auto-advance (bounded, ≤3 hops)
  // before showing the empty state.
  const autoAdvanceCount = useRef(0)
  useEffect(() => {
    if (
      step === 'slot' &&
      availability &&
      !isLoadingAvailability &&
      durationMs != null &&
      slots.length === 0 &&
      availability.hasMore &&
      autoAdvanceCount.current < 3
    ) {
      autoAdvanceCount.current += 1
      setMonthOffset(monthOffset + 1)
    }
  }, [step, availability, isLoadingAvailability, durationMs, slots, monthOffset, setMonthOffset])

  const handleSubmit = useCallback(
    async (payload: Record<string, unknown>) => {
      setBookingError(null)
      const result = await book(payload)
      if (result.ok && result.confirmation) {
        setConfirmation(result.confirmation)
        setStep('confirmed')
        onBooked?.(result.confirmation)
        return
      }
      const code = result.code ?? 'TEMPORARILY_UNAVAILABLE'
      setBookingError(code)
      if (code === 'SLOT_TAKEN') {
        // Recover: refresh the grid (the slot vanishes) and reset the timing
        // signal so the retry isn't flagged too-fast.
        setSelectedSlot(null)
        setStep('slot')
        resetSignals()
        void refetchAvailability()
      }
    },
    [book, onBooked, refetchAvailability, resetSignals],
  )

  const escapeHatch = fallbackUrl ? (
    <Button variant="outline" size="small-legacy" href={fallbackUrl} openInNewTab>
      Open in HubSpot
    </Button>
  ) : null

  // ---- terminal / degraded states -----------------------------------------

  if (isLoadingAvailability && !availability) {
    return (
      <div className={cn('flex flex-col gap-[var(--spacing-system-md)]', className)}>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (availabilityError || !availability) {
    return (
      <div className={cn('flex flex-col items-start gap-[var(--spacing-system-md)]', className)}>
        <p className="text-h6 text-ods-text-secondary">
          We couldn&apos;t load available call times. Please try again shortly.
        </p>
        {escapeHatch}
      </div>
    )
  }

  if (!isNativelyBookable(availability)) {
    // Fail closed — never render a half-working native form on a link with
    // questions or consent we can't faithfully reproduce.
    return (
      <div className={cn('flex flex-col items-start gap-[var(--spacing-system-md)]', className)}>
        <p className="text-h6 text-ods-text-secondary">This meeting type is booked directly on HubSpot.</p>
        {escapeHatch}
      </div>
    )
  }

  if (step === 'confirmed' && confirmation && timezone) {
    return (
      <div className={cn('flex flex-col gap-[var(--spacing-system-md)]', className)}>
        <Confirmation
          confirmation={confirmation}
          timezone={timezone}
          onBookAnother={() => {
            setStep(durations.length === 1 ? 'slot' : 'duration')
            setSelectedDay(null)
            setSelectedSlot(null)
            setConfirmation(null)
            setBookingError(null)
            resetSignals()
            void refetchAvailability()
          }}
        />
      </div>
    )
  }

  // ---- the flow ------------------------------------------------------------

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-md)]', className)}>
      {step === 'duration' && (
        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <p className="text-h5 text-ods-text-primary">How long do you need?</p>
          <div className="flex flex-wrap gap-[var(--spacing-system-xs)]">
            {durations.map((ms) => (
              <Button
                key={ms}
                variant="outline"
                size="small-legacy"
                onClick={() => {
                  setDurationMs(ms)
                  setStep('slot')
                }}
              >
                {formatDurationCompact(ms / 1000)}
              </Button>
            ))}
            {durations.length === 0 && (
              <p className="text-h6 text-ods-text-secondary">No call times are published right now.</p>
            )}
          </div>
        </div>
      )}

      {step === 'slot' && durationMs != null && (
        <div className="flex flex-col gap-[var(--spacing-system-md)]">
          <div className="flex items-center justify-between gap-[var(--spacing-system-xs)]">
            <p className="text-h5 text-ods-text-primary">Pick a time · {formatDurationCompact(durationMs / 1000)}</p>
            {durations.length > 1 && (
              <Button
                variant="outline"
                size="small-legacy"
                onClick={() => {
                  setStep('duration')
                  setSelectedDay(null)
                  setSelectedSlot(null)
                }}
              >
                Change duration
              </Button>
            )}
          </div>
          {bookingError === 'SLOT_TAKEN' && (
            <p className="text-h6 text-ods-error">
              That time is no longer available — if you just submitted, check your email for a confirmation before
              rebooking.
            </p>
          )}
          {timezone ? (
            slots.length > 0 ? (
              <SlotPicker
                slots={slots}
                timezone={timezone}
                monthOffset={monthOffset}
                onMonthOffsetChange={(o) => {
                  setSelectedDay(null)
                  setSelectedSlot(null)
                  setMonthOffset(o)
                }}
                selectedSlot={selectedSlot}
                onSelectSlot={(ms) => {
                  setSelectedSlot(ms)
                  setStep('details')
                }}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
            ) : (
              <div className="flex flex-col items-start gap-[var(--spacing-system-md)]">
                <p className="text-h6 text-ods-text-secondary">
                  {isLoadingAvailability ? 'Checking more dates…' : 'No call times are published right now.'}
                </p>
                {!isLoadingAvailability && escapeHatch}
              </div>
            )
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </div>
      )}

      {step === 'details' && durationMs != null && selectedSlot != null && timezone && (
        <div className="flex flex-col gap-[var(--spacing-system-md)]">
          <p className="text-h5 text-ods-text-primary">
            {new Intl.DateTimeFormat(undefined, {
              timeZone: timezone,
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            }).format(new Date(selectedSlot))}{' '}
            · {formatDurationCompact(durationMs / 1000)}
          </p>
          {bookingError && bookingError !== 'SLOT_TAKEN' && (
            <div className="flex flex-col items-start gap-[var(--spacing-system-xs)]">
              <p className="text-h6 text-ods-error">
                {bookingError === 'TEMPORARILY_UNAVAILABLE'
                  ? 'Scheduling is briefly unavailable — please try again in a minute.'
                  : bookingError === 'MEETING_UNAVAILABLE'
                    ? 'This meeting type has reached its booking limit for today — try another time or contact us.'
                    : bookingError === 'LINK_GONE'
                      ? 'This meeting type is no longer available.'
                      : 'Please double-check your details and try again.'}
              </p>
              {escapeHatch}
            </div>
          )}
          <BookingForm
            availability={availability}
            meetingId={meetingId}
            startTimeMs={selectedSlot}
            durationMs={durationMs}
            timezone={timezone}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onBack={() => {
              setStep('slot')
              setBookingError(null)
            }}
            honeypotInputProps={honeypotInputProps}
            getSignals={getSignals}
          />
        </div>
      )}
    </div>
  )
}

export type { MeetingAvailability, BookingConfirmation, MeetingBookingErrorCode }
