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
 * LAYOUT (Calendly-anatomy, conversion-first): one bordered card, two
 * panels. Left/top — the CONTEXT panel: host identity (avatar + name +
 * title from `availability.hosts`), meeting title/description, duration
 * chips (the duration choice lives here, NOT as a wizard step — the visitor
 * always lands straight on the calendar), and the resolved timezone.
 * Right/bottom — the ACTION panel: calendar + time slots (first available
 * day auto-selected so slots are visible immediately), then the details
 * form, then the confirmation. Panels stack on mobile.
 *
 * Two modes, one component:
 *  - SSR mode: pass `initialAvailability` (host-fetched) — the
 *    zone-independent shell (context panel, calendar) renders server-side;
 *    slot TIME labels wait for the client zone resolution (deterministic
 *    first paint, no hydration mismatch), and availability is refetched
 *    unconditionally after mount (the seed is scaffolding for a 60s-volatile
 *    resource, not truth).
 *  - Client mode: omit the seed — skeleton + self-fetch on mount.
 *
 * State machine: slot → details → confirmed, with a back edge, a "book
 * another" reset, and a `submitting` lock as the double-booking guard.
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
  type MeetingHost,
} from '../../schemas/meeting-booking-schema'
import { SchedulerContextPanel } from './context-panel'
import { SlotPicker, dayKeyInZone } from './slot-picker'
import { BookingForm } from './booking-form'
import { Confirmation } from './confirmation'

export interface HubSpotMeetingSchedulerProps {
  /** Directory id of the meeting link (from the host's `/api/meetings` payload). */
  meetingId: string
  /** Endpoints prefix, default '' (same-origin `/api/meetings/*`) — FaqSection precedent. */
  apiBaseUrl?: string
  /** SSR-mode seed (host-fetched). Omitted → client mode (self-fetch on mount). */
  initialAvailability?: MeetingAvailability
  /** Meeting title shown in the context panel (host page owns the h1). */
  title?: string
  /** Short description under the title in the context panel. */
  description?: string | null
  /** Override the hosts shown (defaults to `availability.hosts`). */
  hosts?: MeetingHost[]
  /** Pin the DISPLAY zone (rendering only — never sent upstream, never a cache key). */
  displayTimezone?: string
  /** The link's public HubSpot booking URL — the "Open in HubSpot" escape hatch target. */
  fallbackUrl?: string
  onBooked?: (b: BookingConfirmation) => void
  className?: string
}

type Step = 'slot' | 'details' | 'confirmed'

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
  title,
  description,
  hosts,
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

  const [step, setStep] = useState<Step>('slot')
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null)
  const [bookingError, setBookingError] = useState<MeetingBookingErrorCode | null>(null)

  const { honeypotInputProps, getSignals, resetSignals } = useHumanitySignals()

  // Reset the machine when the host switches links.
  useEffect(() => {
    setStep('slot')
    setDurationMs(null)
    setSelectedDay(null)
    setSelectedSlot(null)
    setConfirmation(null)
    setBookingError(null)
    autoAdvanceCount.current = 0
  }, [meetingId])

  const durations = availability?.durationsMs ?? []
  const shownHosts = hosts ?? availability?.hosts ?? []

  // Default to the first offered duration — the visitor lands straight on
  // the calendar; duration is a context-panel chip, not a wizard step.
  useEffect(() => {
    if (durationMs == null && durations.length > 0) setDurationMs(durations[0])
  }, [durationMs, durations])

  const slots = useMemo(() => {
    if (!availability || durationMs == null) return []
    return availability.slotsByDurationMs[String(durationMs)] ?? []
  }, [availability, durationMs])

  // Auto-select the first day that has slots (once the zone is known) so the
  // visitor sees concrete times immediately — never a dead "pick a day" state.
  useEffect(() => {
    if (step !== 'slot' || !timezone || slots.length === 0) return
    const dayKeys = new Set(slots.map((ms) => dayKeyInZone(ms, timezone)))
    if (selectedDay && dayKeys.has(selectedDay)) return
    setSelectedDay(dayKeyInZone(slots[0], timezone))
  }, [step, timezone, slots, selectedDay])

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
    // Component-shaped skeleton: mirrors the real card 1:1 (context panel
    // avatar/name/meta rows; action panel section label + 7×5 day grid +
    // time chips) so the loaded state replaces it without ANY layout shift.
    return (
      <div className={cn('rounded-md border border-ods-border bg-ods-card overflow-hidden', className)}>
        <div className="flex flex-col md:flex-row">
          <div className="p-[var(--spacing-system-lf)] md:w-80 md:shrink-0 border-b md:border-b-0 md:border-r border-ods-border flex flex-col gap-[var(--spacing-system-mf)]">
            <div className="flex items-center gap-[var(--spacing-system-s)]">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex flex-col gap-[var(--spacing-system-xxs)] flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="flex-1 min-w-0 p-[var(--spacing-system-lf)] md:min-h-[26rem] flex flex-col gap-[var(--spacing-system-md)]">
            <Skeleton className="h-5 w-44" />
            <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)]">
              <div className="flex flex-col gap-[var(--spacing-system-s)] shrink-0">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }, (_, i) => (
                    <Skeleton key={i} className="h-9 w-9" />
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-s)]">
                <Skeleton className="h-5 w-40" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--spacing-system-xs)] content-start">
                  {Array.from({ length: 9 }, (_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (availabilityError || !availability) {
    return (
      <div
        className={cn(
          'rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)] flex flex-col items-start gap-[var(--spacing-system-md)]',
          className,
        )}
      >
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
      <div
        className={cn(
          'rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)] flex flex-col items-start gap-[var(--spacing-system-md)]',
          className,
        )}
      >
        <p className="text-h6 text-ods-text-secondary">This meeting type is booked directly on HubSpot.</p>
        {escapeHatch}
      </div>
    )
  }

  // ---- the card ------------------------------------------------------------

  return (
    <div className={cn('rounded-md border border-ods-border bg-ods-card overflow-hidden', className)}>
      <div className="flex flex-col md:flex-row">
        <SchedulerContextPanel
          hosts={shownHosts}
          title={title}
          description={description}
          durationsMs={durations}
          selectedDurationMs={durationMs}
          onSelectDuration={(ms) => {
            setDurationMs(ms)
            setSelectedDay(null)
            setSelectedSlot(null)
            if (step === 'details') setStep('slot')
          }}
          timezone={timezone}
          className="p-[var(--spacing-system-lf)] md:w-80 md:shrink-0 border-b md:border-b-0 md:border-r border-ods-border"
        />

        {/* min-height pins the card so slot ⇄ details ⇄ confirmed transitions
            never jump the page. */}
        <div className="flex-1 min-w-0 p-[var(--spacing-system-lf)] md:min-h-[26rem]">
          {step === 'confirmed' && confirmation && timezone ? (
            <Confirmation
              confirmation={confirmation}
              timezone={timezone}
              onBookAnother={() => {
                setStep('slot')
                setSelectedDay(null)
                setSelectedSlot(null)
                setConfirmation(null)
                setBookingError(null)
                resetSignals()
                void refetchAvailability()
              }}
            />
          ) : step === 'details' && durationMs != null && selectedSlot != null && timezone ? (
            <div className="flex flex-col gap-[var(--spacing-system-md)]">
              <p className="text-h5 text-ods-text-secondary">Your details</p>
              <p className="text-h4 text-ods-text-primary">
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
          ) : (
            <div className="flex flex-col gap-[var(--spacing-system-md)]">
              <p className="text-h5 text-ods-text-secondary">Select a date &amp; time</p>
              {bookingError === 'SLOT_TAKEN' && (
                <p className="text-h6 text-ods-error">
                  That time is no longer available — if you just submitted, check your email for a confirmation
                  before rebooking.
                </p>
              )}
              {timezone && durationMs != null ? (
                slots.length > 0 || isLoadingAvailability ? (
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
                    isLoading={isLoadingAvailability}
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
                <Skeleton className="h-72 w-full" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export type { MeetingAvailability, BookingConfirmation, MeetingBookingErrorCode, MeetingHost }
