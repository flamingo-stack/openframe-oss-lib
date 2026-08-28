'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  MEETING_BOOKING_ERROR_CODES,
  type BookingConfirmation,
  type MeetingAvailability,
  type MeetingBookingErrorCode,
} from '../schemas/meeting-booking-schema';
import { contentFetch } from '../utils/embed-content-fetch';
import { MAX_MONTH_OFFSET } from '../utils/hubspot-meetings-convention';

/**
 * useMeetingBooking — data layer for `<HubSpotMeetingScheduler>` (the widget
 * files never inline fetch; same split as `useContactSubmission`/ContactForm).
 *
 * REQUIRES a `QueryClientProvider` in the host, like every other query-backed
 * surface in this lib (tickets, chat, onboarding-guides). `@tanstack/react-query`
 * is a declared peer dependency; the lib never mounts a provider of its own.
 *
 * Availability is a per-month GET, cached per (host, link, month). The cache is
 * the point: paging back to a month already seen is INSTANT and silent, which
 * is what a hand-rolled `useEffect` + `useState` could not do — it re-fetched
 * and re-skeletoned the same month every time the visitor stepped back.
 *
 * Deliberately NOT `placeholderData: keepPreviousData`. The payload is
 * month-scoped, so last month's slots under this month's caption describe days
 * that aren't on screen — a grid that lights up the wrong dates is worse than
 * one that is briefly inert. What kills the flicker instead is WHERE the
 * loading state lands: the calendar is fully derivable from the date alone, so
 * it keeps rendering (with nothing selectable yet) while only the times column
 * — the part that genuinely has no answer — shows a placeholder.
 *
 * `staleTime` is ZERO: the host serves availability live (no-store), and a
 * cached month re-shown while paging back is organizer-visible staleness. A
 * slot gone by the time it is clicked costs a booking — always refetch.
 *
 * Booking: a mutation, guarded so a second submit can't start while one is in
 * flight (the transport never retries POST — this is the only double-booking
 * guard). Errors surface as typed `MeetingBookingErrorCode`s the widget keys
 * its recovery UI off, never as thrown rejections.
 *
 * All requests go through the host proxy (`apiBaseUrl` prefix, FaqSection
 * precedent) via `contentFetch`, so embedded hosts with an embed-auth adapter
 * inherit auth with zero extra wiring.
 */

export interface BookingResult {
  ok: boolean;
  confirmation?: BookingConfirmation;
  code?: MeetingBookingErrorCode;
  message?: string;
}

/** Always refetch — availability is served live (no-store) by the host; a
 *  cached month shown while paging back is exactly the staleness the server
 *  layers were stripped to kill (2026-08-27). */
const AVAILABILITY_STALE_MS = 0;

/** Query key for one month of one link. Exported so a host can prefetch or
 *  invalidate a month it knows changed (e.g. after booking elsewhere). */
export function meetingAvailabilityKey(apiBaseUrl: string, meetingId: string, monthOffset: number) {
  return ['meeting-availability', apiBaseUrl, meetingId, monthOffset] as const;
}

export function useMeetingBooking(options: {
  meetingId: string;
  apiBaseUrl?: string;
  initialAvailability?: MeetingAvailability;
}) {
  const { meetingId, apiBaseUrl = '', initialAvailability } = options;
  const queryClient = useQueryClient();

  const seededOffset = initialAvailability?.meetingId === meetingId ? initialAvailability.monthOffset : undefined;
  const [monthOffset, setMonthOffsetState] = useState(seededOffset ?? 0);

  const setMonthOffset = useCallback((offset: number) => {
    setMonthOffsetState(Math.max(0, Math.min(MAX_MONTH_OFFSET, offset)));
  }, []);

  // Link switch resets paging — without this, the new link is queried at the
  // PREVIOUS link's month. Layout effect so the query below sees the reset
  // offset in the same commit.
  const prevMeetingIdRef = useRef(meetingId);
  useLayoutEffect(() => {
    if (prevMeetingIdRef.current === meetingId) return;
    prevMeetingIdRef.current = meetingId;
    setMonthOffsetState(0);
  }, [meetingId]);

  // The SSR seed covers exactly one (link, month) cell of the cache.
  const seed =
    initialAvailability?.meetingId === meetingId && initialAvailability.monthOffset === monthOffset
      ? initialAvailability
      : undefined;

  const availabilityQuery = useQuery({
    queryKey: meetingAvailabilityKey(apiBaseUrl, meetingId, monthOffset),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ meeting: meetingId, monthOffset: String(monthOffset) });
      const res = await contentFetch(`${apiBaseUrl}/api/meetings/availability?${params}`, { signal });
      if (!res.ok) throw new Error(`availability ${res.status}`);
      return (await res.json()) as MeetingAvailability;
    },
    staleTime: AVAILABILITY_STALE_MS,
    initialData: seed,
    // Stamped as infinitely old on purpose: the seed is first-paint
    // scaffolding for a 60-second-volatile resource, not truth, so it paints
    // immediately AND is refetched immediately.
    initialDataUpdatedAt: seed ? 0 : undefined,
  });

  const refetchAvailability = useCallback(async () => {
    // Recovery path (a slot taken from under the visitor): drop the cached
    // month so the grid reloads from the network, not from the copy that
    // still lists the taken slot. Best-effort — a failure leaves the stale
    // grid up rather than blanking the card.
    await queryClient
      .invalidateQueries({ queryKey: meetingAvailabilityKey(apiBaseUrl, meetingId, monthOffset) })
      .catch(() => undefined);
  }, [queryClient, apiBaseUrl, meetingId, monthOffset]);

  const bookMutation = useMutation<BookingResult, never, Record<string, unknown>>({
    mutationFn: async payload => {
      try {
        const res = await contentFetch(`${apiBaseUrl}/api/meetings/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (res.ok) return { ok: true, confirmation: data as unknown as BookingConfirmation };
        const rawCode = typeof data.code === 'string' ? data.code : '';
        const code = (MEETING_BOOKING_ERROR_CODES as readonly string[]).includes(rawCode)
          ? (rawCode as MeetingBookingErrorCode)
          : 'TEMPORARILY_UNAVAILABLE';
        return { ok: false, code, message: typeof data.error === 'string' ? data.error : undefined };
      } catch {
        return { ok: false, code: 'TEMPORARILY_UNAVAILABLE' };
      }
    },
    // A booking is not a read — never retried, at any layer.
    retry: false,
  });

  // `isPending` alone would not stop a second submit dispatched in the same
  // tick as the first; the ref closes that window the way the pre-query
  // implementation did.
  // Holds the identity of the submit that owns the lock (`null` = idle) rather
  // than a bare boolean, so the release below — which runs after an await — can
  // check that the lock it clears is still its own rather than clearing
  // whatever happens to be there when the booking settles.
  const submittingRef = useRef<object | null>(null);
  const { mutateAsync } = bookMutation;
  const book = useCallback(
    async (payload: Record<string, unknown>): Promise<BookingResult> => {
      if (submittingRef.current !== null) return { ok: false, code: 'VALIDATION', message: 'Already submitting' };
      const submitToken: object = {};
      submittingRef.current = submitToken;
      try {
        return await mutateAsync(payload);
      } finally {
        if (submittingRef.current === submitToken) submittingRef.current = null;
      }
    },
    [mutateAsync],
  );

  return {
    availability: availabilityQuery.data ?? null,
    /** No availability for this month yet — the times column has nothing to show. */
    isLoadingAvailability: availabilityQuery.isPending,
    /** ANY request in flight, including a silent revalidation of cached data. */
    isFetchingAvailability: availabilityQuery.isFetching,
    availabilityError: availabilityQuery.error ? availabilityQuery.error.message : null,
    monthOffset,
    setMonthOffset,
    refetchAvailability,
    book,
    isSubmitting: bookMutation.isPending,
  } as const;
}
