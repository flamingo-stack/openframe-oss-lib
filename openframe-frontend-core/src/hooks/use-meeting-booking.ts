'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { contentFetch } from '../utils/embed-content-fetch'
import { MAX_MONTH_OFFSET } from '../utils/hubspot-meetings-convention'
import type {
  BookingConfirmation,
  MeetingAvailability,
  MeetingBookingErrorCode,
} from '../schemas/meeting-booking-schema'

/**
 * useMeetingBooking — data layer for `<HubSpotMeetingScheduler>` (the widget
 * files never inline fetch; same split as `useContactSubmission`/ContactForm).
 *
 * Availability: plain `useState` + `useEffect` + `AbortController` self-fetch
 * (NO client cache layer). An `initialAvailability` seed (SSR mode) renders
 * immediately, but the hook REFETCHES UNCONDITIONALLY after mount — the seed
 * is first-paint scaffolding for a 60-second-volatile resource, not truth.
 *
 * Booking: single POST guarded by `isSubmitting` (the only double-booking
 * guard — the transport never retries POST). Errors surface as typed
 * `MeetingBookingErrorCode`s the widget keys its recovery UI off.
 *
 * All requests go through the host proxy (`apiBaseUrl` prefix, FaqSection
 * precedent) via `contentFetch`, so embedded hosts with an embed-auth adapter
 * inherit auth with zero extra wiring.
 */

export interface BookingResult {
  ok: boolean
  confirmation?: BookingConfirmation
  code?: MeetingBookingErrorCode
  message?: string
}

const KNOWN_CODES: MeetingBookingErrorCode[] = [
  'SLOT_TAKEN',
  'VALIDATION',
  'LINK_GONE',
  'TEMPORARILY_UNAVAILABLE',
  'MEETING_UNAVAILABLE',
]

export function useMeetingBooking(options: {
  meetingId: string
  apiBaseUrl?: string
  initialAvailability?: MeetingAvailability
}) {
  const { meetingId, apiBaseUrl = '', initialAvailability } = options
  const seededFor = initialAvailability?.meetingId === meetingId ? initialAvailability : undefined

  const [availability, setAvailability] = useState<MeetingAvailability | null>(seededFor ?? null)
  const [monthOffset, setMonthOffsetState] = useState(seededFor?.monthOffset ?? 0)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(!seededFor)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const setMonthOffset = useCallback((offset: number) => {
    setMonthOffsetState(Math.max(0, Math.min(MAX_MONTH_OFFSET, offset)))
  }, [])

  // Unconditional (re)fetch on mount and on (meetingId, monthOffset) change —
  // even when SSR-seeded (the seed may already be stale).
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const load = async () => {
      // Keep the seeded grid on screen during the refresh (skeleton only when
      // there is genuinely nothing to show).
      setAvailabilityError(null)
      if (!availability || availability.meetingId !== meetingId) setIsLoadingAvailability(true)
      try {
        const params = new URLSearchParams({ meeting: meetingId, monthOffset: String(monthOffset) })
        const res = await contentFetch(`${apiBaseUrl}/api/meetings/availability?${params}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`availability ${res.status}`)
        const data = (await res.json()) as MeetingAvailability
        if (active) setAvailability(data)
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === 'AbortError')) return
        setAvailabilityError(err instanceof Error ? err.message : 'Failed to load availability')
      } finally {
        if (active) setIsLoadingAvailability(false)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch is keyed on (meetingId, monthOffset) only; `availability` is read for skeleton gating, not as a trigger
  }, [meetingId, monthOffset, apiBaseUrl])

  const refetchAvailability = useCallback(async () => {
    try {
      const params = new URLSearchParams({ meeting: meetingId, monthOffset: String(monthOffset) })
      const res = await contentFetch(`${apiBaseUrl}/api/meetings/availability?${params}`)
      if (res.ok) setAvailability((await res.json()) as MeetingAvailability)
    } catch {
      /* recovery refetch is best-effort — the stale grid stays visible */
    }
  }, [meetingId, monthOffset, apiBaseUrl])

  const book = useCallback(
    async (payload: Record<string, unknown>): Promise<BookingResult> => {
      if (submittingRef.current) return { ok: false, code: 'VALIDATION', message: 'Already submitting' }
      submittingRef.current = true
      setIsSubmitting(true)
      try {
        const res = await contentFetch(`${apiBaseUrl}/api/meetings/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        if (res.ok) return { ok: true, confirmation: data as unknown as BookingConfirmation }
        const rawCode = typeof data.code === 'string' ? data.code : ''
        const code = (KNOWN_CODES as string[]).includes(rawCode)
          ? (rawCode as MeetingBookingErrorCode)
          : 'TEMPORARILY_UNAVAILABLE'
        return { ok: false, code, message: typeof data.error === 'string' ? data.error : undefined }
      } catch {
        return { ok: false, code: 'TEMPORARILY_UNAVAILABLE' }
      } finally {
        submittingRef.current = false
        setIsSubmitting(false)
      }
    },
    [apiBaseUrl],
  )

  return {
    availability,
    isLoadingAvailability,
    availabilityError,
    monthOffset,
    setMonthOffset,
    refetchAvailability,
    book,
    isSubmitting,
  } as const
}
