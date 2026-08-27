'use client';

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
 * panels. Left/top — the CONTEXT panel: an optional host-level back edge
 * (`onBack`), host identity (avatar + name + title from
 * `availability.hosts`), meeting title/description, duration chips (the
 * duration choice lives here, NOT as a wizard step — the visitor always
 * lands straight on the calendar), and the resolved timezone.
 * Right/bottom — the ACTION panel: calendar + time slots (first available
 * day auto-selected so slots are visible immediately), then the details
 * form, then the confirmation. On the slot step that panel splits again —
 * calendar column, then times column — each carrying its own heading (owned
 * by `SlotPicker`, so loading and loaded agree). Panels stack on mobile.
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useHumanitySignals } from '../../hooks/use-humanity-signals';
import { useMeetingBooking } from '../../hooks/use-meeting-booking';
import { useToast } from '../../hooks/use-toast';
import {
  isSupportedFormField,
  type BookingConfirmation,
  type MeetingAvailability,
  type MeetingBookingErrorCode,
  type MeetingHost,
} from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import { formatDurationCompact } from '../../utils/format';
import { Alert, AlertDescription, Button } from '../ui';
import { BookingForm } from './booking-form';
import { Confirmation } from './confirmation';
import { SchedulerContextPanel, ContextPanelSkeleton } from './context-panel';
import { SlotPicker, SlotPickerSkeleton, dayKeyInZone } from './slot-picker';

/**
 * Visitor-facing copy per booking-error code. Everything except SLOT_TAKEN
 * surfaces PRIMARILY as an error TOAST at submit time (every hub platform
 * mounts the lib Toaster globally), with a compact inline line above the form
 * as the fallback for embedders without a Toaster — that line also carries
 * the escape hatch. SLOT_TAKEN renders above the calendar instead: its
 * recovery flow returns the visitor there. An unrecognized code (newer host
 * than widget) falls back to the VALIDATION copy — fail-safe, never blank.
 */
const BOOKING_ERROR_COPY: Record<Exclude<MeetingBookingErrorCode, 'SLOT_TAKEN'>, string> = {
  INVALID_EMAIL:
    'That email address was rejected by our scheduling system — please use a real, reachable address (work email works best).',
  VALIDATION:
    'Please double-check your details — especially that the email address is real and reachable — and try again.',
  TEMPORARILY_UNAVAILABLE: 'Scheduling is briefly unavailable — please try again in a minute.',
  MEETING_UNAVAILABLE: 'This meeting type has reached its booking limit for today — try another time or contact us.',
  LINK_GONE: 'This meeting type is no longer available.',
};

export interface HubSpotMeetingSchedulerProps {
  /** Directory id of the meeting link (from the host's `/api/meetings` payload). */
  meetingId: string;
  /** Endpoints prefix, default '' (same-origin `/api/meetings/*`) — FaqSection precedent. */
  apiBaseUrl?: string;
  /** SSR-mode seed (host-fetched). Omitted → client mode (self-fetch on mount). */
  initialAvailability?: MeetingAvailability;
  /** Meeting title shown in the context panel (host page owns the h1). */
  title?: string;
  /** Short description under the title in the context panel. */
  description?: string | null;
  /** Override the hosts shown (defaults to `availability.hosts`). */
  hosts?: MeetingHost[];
  /** Pin the DISPLAY zone (rendering only — never sent upstream, never a cache key). */
  displayTimezone?: string;
  /** The link's public HubSpot booking URL — the "Open in HubSpot" escape hatch target. */
  fallbackUrl?: string;
  /**
   * Host-level exit, rendered as a back edge at the top of the context panel
   * (and in the loading skeleton, so it doesn't pop in). This is "leave the
   * scheduler", NOT the details step's back edge — it is suppressed once a
   * slot is chosen so only one Back is ever on screen. Omit it and no back
   * affordance renders at all.
   */
  onBack?: () => void;
  onBooked?: (b: BookingConfirmation) => void;
  className?: string;
}

type Step = 'slot' | 'details' | 'confirmed';

/** Context-panel geometry — ONE definition for the loaded card and the
 *  loading skeleton, which is what keeps the two footprint-identical. */
const CONTEXT_PANEL_CLASS =
  'p-[var(--spacing-system-l)] shrink-0 lg:w-[280px] border-b lg:border-b-0 lg:border-r border-ods-border lg:min-h-0 lg:overflow-y-auto';

/**
 * Action panel: the elastic half, scrolling inside the fixed card.
 *
 * Padded only from `lg`. Below it the calendar and times are separate sections
 * with a divider between them, and each pads itself — one padding here would
 * inset that divider from the card's edges instead of letting it run the full
 * width the way every other rule in this card does.
 */
const ACTION_PANEL_CLASS = 'flex-1 min-w-0 flex flex-col md:min-h-0 lg:p-[var(--spacing-system-l)]';

/**
 * The action panel's inset for the steps that are ONE block — details,
 * confirmation, the slot step's error line.
 *
 * The panel itself is padded only from `lg`, because below that the slot step
 * is two sections with a rule between them and each pads itself: one padding
 * on the panel would inset that rule instead of letting it run the card's full
 * width, the way every other rule here does. Every step that is NOT split into
 * sections has to bring the same inset with it — without it the form ran edge
 * to edge on tablet, its inputs touching the card's border.
 *
 * `md:min-h-0 md:overflow-y-auto` comes with it: from `md` up the card states
 * a height, and these steps have no inner scroller of their own the way the
 * times column does, so this is where a long form gets to scroll instead of
 * being cut off at the card's edge.
 */
const PANEL_STEP_CLASS = 'p-[var(--spacing-system-l)] md:min-h-0 md:overflow-y-auto lg:p-0';

/**
 * The widget's height on desktop: a FIXED 380px, and the ONLY size the whole
 * card states.
 *
 * A floor was not enough. Every stage has a different natural height — the
 * context panel with two hosts ~340, the calendar column ~290, a degraded
 * stage two lines — so `min-height` only pinned the SHORT ones and let the
 * tall one push the wrapper, which is exactly the screen-shake this removes.
 * With a fixed height the box is stated once and nothing inside can move it;
 * anything taller scrolls in place.
 *
 * The elastic half derives from it: the panel passes it to the slot row and
 * the times column scrolls inside what is left. The calendar does not stretch
 * — a date grid has a size, and stretching one is how a month turns into
 * page-tall bands the moment a layout stops pinning a height. It states a
 * WIDTH (`CALENDAR_W`) and its square cells make it as tall as it is wide;
 * that width is chosen to fit inside this number, and the two are checked
 * against each other in one place rather than three.
 *
 * Six week rows, always — `fixedWeeks` — is why a height can be stated at all:
 * a 5-week month and a 6-week month occupy the same box, so paging the
 * calendar cannot resize the card.
 *
 * Exported because the stability has to survive OUTSIDE the card too: a host
 * that swaps the scheduler in and out of a slot (the onboarding "Book a call"
 * promo does exactly that) reserves the same box for whatever it shows
 * instead, so the swap moves nothing below it.
 *
 * Goes on the BORDERED element, always. Under `box-sizing: border-box` the
 * declared height swallows the 1px edges, so a card that carries the border
 * and a host box that carries its own both come out at exactly 380 — put it on
 * an inner wrapper instead and the border lands OUTSIDE the 380, making that
 * card 2px taller than everything it is supposed to match.
 *
 * TWO numbers, because the card has two shapes: 380 as a sidebar beside the
 * calendar (`lg`), 550 as a header strip over it (`md`). Phones get neither —
 * there a card the height of the hand holding it is the right answer and the
 * page is the scroller.
 *
 * A host that reserves this box owes it one thing: content that ADAPTS to the
 * height rather than assuming it. The onboarding promo does it by letting its
 * video take the leftover space at 16:9; a stand-in that just stacks fixed
 * blocks will overflow the shorter of the two.
 */
export const MEETING_SCHEDULER_H = 'md:h-[34.375rem] lg:h-[23.75rem]';

/**
 * The two-panel card's box, shared verbatim by the loading skeleton and the
 * loaded card so neither can drift from the other.
 *
 * Both heights come from {@link MEETING_SCHEDULER_H}; what this adds is the
 * flex column that makes them work. On TABLET the height is stated for the
 * same reason the desktop one is: a CEILING only pins the tall stages. The short ones — the empty
 * month ("No available times in September"), a five-week month, the cold-start
 * skeleton — each settled at their own natural height, so paging a month or
 * waiting out a fetch resized the card under the visitor. Stating the height
 * makes every stage the same box and moves the variation inside, where the
 * times column already scrolls.
 *
 * 550, not the mock's 498: the mock draws one host and no timezone field, and
 * a real link has two hosts and a zone the visitor must be able to change.
 * That is ~55px of content the mock never budgeted for, and the month below it
 * is what would otherwise pay for it.
 *
 * The strip is `shrink-0`, so what is left goes to the slot row, which spends
 * it on a calendar sized to fit (no scroll) and a times list that scrolls on
 * its own.
 *
 * `md:flex md:flex-col` is what makes that possible at all. A stated height on
 * a plain block only clips (this card is `overflow-hidden` for its corners) —
 * it is the flex column plus the inner wrapper's `min-h-0` that lets the
 * content shrink into the height instead of being cut off by it.
 */
const CARD_CLASS = cn(
  'overflow-hidden rounded-md border border-ods-border bg-ods-card',
  'md:flex md:flex-col',
  MEETING_SCHEDULER_H,
);

/** Context strip over action panel, side by side from `lg`. `md:flex-1
 *  md:min-h-0` is the pair that makes it exactly as tall as the card states —
 *  grow into a stated height that content does not reach, shrink into one it
 *  overruns — so neither a short stage nor a long one changes the box. */
const CARD_INNER_CLASS = 'flex flex-col md:min-h-0 md:flex-1 lg:h-full lg:flex-row';

/** The two-line stages (load failure, "booked on HubSpot") — the SAME box as
 *  the booking card, because these are stages of one widget in one slot and a
 *  stage that collapses to two lines would snap the page shut under the
 *  visitor. Their content is centred in it and scrolls if a message ever
 *  outgrows it. */
const CARD_DEGRADED_CLASS = cn(
  'flex flex-col items-start gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]',
  'md:justify-center md:overflow-y-auto',
  MEETING_SCHEDULER_H,
);

/**
 * Fail-closed gate: a link whose declared questions include an unsupported
 * type, or whose consent block is malformed, must NOT render a half-working
 * native form (a silently dropped required question or missing consent copy
 * is worse than no native form) — the escape hatch takes over.
 */
function isNativelyBookable(availability: MeetingAvailability): boolean {
  if (!availability.formFields.every(isSupportedFormField)) return false;
  const consent = availability.legalConsent;
  if (consent) {
    if (typeof consent.processingConsentText !== 'string') return false;
    if (!Array.isArray(consent.communicationConsentCheckboxes)) return false;
  }
  return true;
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
  onBack,
  onBooked,
  className,
}: HubSpotMeetingSchedulerProps) {
  const {
    availability,
    isLoadingAvailability,
    isFetchingAvailability,
    availabilityError,
    monthOffset,
    setMonthOffset,
    refetchAvailability,
    book,
    isSubmitting,
  } = useMeetingBooking({ meetingId, apiBaseUrl, initialAvailability });

  // Zone resolution happens POST-mount (Intl) unless the embedder pins one —
  // the initial (server) render stays deterministic; time labels appear once
  // a zone exists.
  //
  // Priority, unchanged: the visitor's own pick (the panel's zone selector) >
  // the embedder's `displayTimezone` > the browser's resolved zone. Only the
  // last of the three is client-only, so `useIsHydrated` is the whole reason
  // this could not be computed during render — with that gate stated directly,
  // the zone is DERIVED and the effect that used to publish it (a setState in
  // an effect body, and a dead render for every mount) is gone.
  const hydrated = useIsHydrated();
  const [pickedTimezone, setTimezone] = useState<string | null>(null);
  const resolvedLocalTimezone = useMemo(() => {
    if (!hydrated) return null;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, [hydrated]);
  const timezone = pickedTimezone ?? displayTimezone ?? resolvedLocalTimezone;

  const [step, setStep] = useState<Step>('slot');
  const [pickedDurationMs, setDurationMs] = useState<number | null>(null);
  const [pickedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [bookingError, setBookingError] = useState<MeetingBookingErrorCode | null>(null);

  const { honeypotInputProps, getSignals, resetSignals } = useHumanitySignals();
  const { toast } = useToast();

  // Reset the machine when the host switches links. Adjusted while rendering —
  // React's documented pattern for a prop-driven reset — so the swapped-in link
  // never paints a frame of the previous link's chosen day, slot or
  // confirmation. The ref counter stays in an effect: a ref must not be written
  // during render.
  const autoAdvanceCount = useRef(0);
  const [machineFor, setMachineFor] = useState(meetingId);
  if (machineFor !== meetingId) {
    setMachineFor(meetingId);
    setStep('slot');
    setDurationMs(null);
    setSelectedDay(null);
    setSelectedSlot(null);
    setConfirmation(null);
    setBookingError(null);
  }
  useEffect(() => {
    autoAdvanceCount.current = 0;
  }, [meetingId]);

  // Memoised because the `??` fallback minted a NEW array on every
  // render, which made the memo below re-run every time — i.e. do nothing.
  const durations = useMemo(() => availability?.durationsMs ?? [], [availability?.durationsMs]);
  const shownHosts = hosts ?? availability?.hosts ?? [];

  // Default to the first offered duration — the visitor lands straight on
  // the calendar; duration is a context-panel chip, not a wizard step.
  // Derived, not stored: "no explicit pick yet" already means "the first one
  // offered", so the effect that used to write that back into state was a
  // second render pass for a value the first render could name — and the frame
  // in between was the empty calendar this default exists to avoid.
  const durationMs = pickedDurationMs ?? durations[0] ?? null;

  const slots = useMemo(() => {
    if (!availability || durationMs == null) return [];
    return availability.slotsByDurationMs[String(durationMs)] ?? [];
  }, [availability, durationMs]);

  // Auto-select the first day WITH SLOTS IN THE VISIBLE MONTH (once the zone
  // is known) so the visitor sees concrete times immediately — never a dead
  // "pick a day" state, and NEVER a day from another month than the calendar
  // shows (HubSpot's monthOffset payloads can carry near-term slots outside
  // the requested month — the visible grid is the authority).
  //
  // Derived, with the visitor's own pick winning for as long as it is still one
  // of the days on offer. Every input — the slots, the visible month, the zone
  // — is available while rendering, so publishing this from an effect only
  // guaranteed that each of those changes committed one dead "pick a day" frame
  // before the calendar filled itself in.
  const selectedDay = useMemo(() => {
    if (step !== 'slot' || !timezone) return pickedDay;
    const now = new Date();
    const visible = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const monthPrefix = `${visible.getFullYear()}-${String(visible.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = slots.filter(ms => dayKeyInZone(ms, timezone).startsWith(monthPrefix));
    if (inMonth.length === 0) {
      // Nothing this month — a pick left over from a different month is not a
      // selection in the grid the visitor is looking at.
      return pickedDay && !pickedDay.startsWith(monthPrefix) ? null : pickedDay;
    }
    const dayKeys = new Set(inMonth.map(ms => dayKeyInZone(ms, timezone)));
    if (pickedDay && dayKeys.has(pickedDay)) return pickedDay;
    return dayKeyInZone(inMonth[0], timezone);
  }, [step, timezone, slots, pickedDay, monthOffset]);

  // Fully-booked month with more ahead → auto-advance (bounded, ≤3 hops)
  // before showing the empty state.
  useEffect(() => {
    if (
      step === 'slot' &&
      availability &&
      !isFetchingAvailability &&
      durationMs != null &&
      slots.length === 0 &&
      availability.hasMore &&
      autoAdvanceCount.current < 3
    ) {
      autoAdvanceCount.current += 1;
      setMonthOffset(monthOffset + 1);
    }
  }, [step, availability, isFetchingAvailability, durationMs, slots, monthOffset, setMonthOffset]);

  /** The back edge's destination from the form: the calendar, with any
   *  submit error cleared so the visitor doesn't carry it back. */
  const backToSlot = useCallback(() => {
    setStep('slot');
    setBookingError(null);
  }, []);

  const handleSubmit = useCallback(
    async (payload: Record<string, unknown>) => {
      setBookingError(null);
      const result = await book(payload);
      if (result.ok && result.confirmation) {
        setConfirmation(result.confirmation);
        setStep('confirmed');
        onBooked?.(result.confirmation);
        return;
      }
      const code = result.code ?? 'TEMPORARILY_UNAVAILABLE';
      setBookingError(code);
      if (code === 'SLOT_TAKEN') {
        // Recover: refresh the grid (the slot vanishes) and reset the timing
        // signal so the retry isn't flagged too-fast.
        setSelectedSlot(null);
        setStep('slot');
        resetSignals();
        void refetchAvailability();
      } else {
        // Primary error surface is a TOAST (host-mounted Toaster — every hub
        // platform mounts it globally). The compact inline line below the
        // date heading stays as the fallback for embedders without a Toaster,
        // and carries the escape hatch.
        toast({
          variant: 'error',
          title: 'Booking failed',
          description: BOOKING_ERROR_COPY[code] ?? BOOKING_ERROR_COPY.VALIDATION,
        });
      }
    },
    [book, onBooked, refetchAvailability, resetSignals, toast],
  );

  const escapeHatch = fallbackUrl ? (
    <Button variant="outline" size="small-legacy" href={fallbackUrl} openInNewTab>
      Open in HubSpot
    </Button>
  ) : null;

  // ---- terminal / degraded states -----------------------------------------

  if (isLoadingAvailability && !availability) {
    // COLD start only — a month already in the query cache renders straight
    // into the loaded card. Composed inside the SAME wrappers as that card
    // (`ContextPanelSkeleton` beside the real slot-area layout), so nothing
    // shifts when it swaps.
    return (
      <div className={cn(CARD_CLASS, className)}>
        <div className={CARD_INNER_CLASS}>
          <ContextPanelSkeleton onBack={onBack} className={CONTEXT_PANEL_CLASS} />
          <div className={ACTION_PANEL_CLASS}>
            <SlotPickerSkeleton monthOffset={monthOffset} />
          </div>
        </div>
      </div>
    );
  }

  if (availabilityError || !availability) {
    return (
      <div className={cn(CARD_DEGRADED_CLASS, className)}>
        <p className="text-ods-text-secondary text-h6">
          We couldn&apos;t load available call times. Please try again shortly.
        </p>
        {escapeHatch}
      </div>
    );
  }

  if (!isNativelyBookable(availability)) {
    // Fail closed — never render a half-working native form on a link with
    // questions or consent we can't faithfully reproduce.
    return (
      <div className={cn(CARD_DEGRADED_CLASS, className)}>
        <p className="text-ods-text-secondary text-h6">This meeting type is booked directly on HubSpot.</p>
        {escapeHatch}
      </div>
    );
  }

  // ---- the card ------------------------------------------------------------

  return (
    <div className={cn(CARD_CLASS, className)}>
      <div className={CARD_INNER_CLASS}>
        <SchedulerContextPanel
          hosts={shownHosts}
          title={title}
          description={description}
          durationsMs={durations}
          selectedDurationMs={durationMs}
          onSelectDuration={ms => {
            setDurationMs(ms);
            setSelectedDay(null);
            setSelectedSlot(null);
            if (step === 'details') setStep('slot');
          }}
          timezone={timezone}
          onTimezoneChange={setTimezone}
          // ONE back edge for the whole card, in the panel that never swaps.
          // Its destination is simply "the previous step": from the form back
          // to the calendar, from the calendar out of the scheduler (if the
          // host gave us an exit at all). Two Backs on screen reading the same
          // word with different destinations was the ambiguity the details
          // step used to carry.
          onBack={step === 'details' ? backToSlot : onBack}
          locked={step !== 'slot'}
          // The zone still governs every time on screen — including the
          // summary line on the form — so the picker stays until there is
          // nothing left to re-read in it.
          showTimezone={step !== 'confirmed'}
          className={CONTEXT_PANEL_CLASS}
        />

        {/* Scrolls INSIDE the fixed card rather than growing it — see
            MEETING_SCHEDULER_H. `min-h-0` is what lets it: a flex item's
            default `min-height:auto` refuses to shrink below its content. */}
        <div className={ACTION_PANEL_CLASS}>
          {step === 'confirmed' && confirmation && timezone ? (
            <div className={cn('flex flex-1 flex-col', PANEL_STEP_CLASS)}>
              <Confirmation confirmation={confirmation} timezone={timezone} />
            </div>
          ) : step === 'details' && durationMs != null && selectedSlot != null && timezone ? (
            <div className={cn('flex flex-1 flex-col gap-[var(--spacing-system-m)]', PANEL_STEP_CLASS)}>
              {/* Top-aligned, and no back edge of its own: the ONE back edge
                  lives in the context panel at every step (see `contextBack`),
                  which is where the design puts it and the only spot that
                  stays put while this side swaps between calendar and form. */}
              <p className="text-ods-text-primary text-h4">
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
                  <p className="text-ods-error text-h6" role="alert">
                    {BOOKING_ERROR_COPY[bookingError] ?? BOOKING_ERROR_COPY.VALIDATION}
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
                honeypotInputProps={honeypotInputProps}
                getSignals={getSignals}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--spacing-system-m)] md:min-h-0 md:flex-1">
              {bookingError === 'SLOT_TAKEN' && (
                <Alert
                  variant="warning"
                  className="mx-[var(--spacing-system-l)] mt-[var(--spacing-system-l)] w-auto lg:m-0 lg:w-full"
                >
                  <AlertDescription>
                    That time was just taken — pick another slot below. (If you already submitted, check your email for
                    a confirmation before rebooking.)
                  </AlertDescription>
                </Alert>
              )}
              {timezone && durationMs != null ? (
                // The picker owns BOTH the loading and the empty month now —
                // it keeps the calendar up either way, so there is no branch
                // here that can take it off screen mid-flow.
                <SlotPicker
                  slots={slots}
                  timezone={timezone}
                  monthOffset={monthOffset}
                  onMonthOffsetChange={o => {
                    setSelectedDay(null);
                    setSelectedSlot(null);
                    setMonthOffset(o);
                  }}
                  selectedSlot={selectedSlot}
                  onSelectSlot={ms => {
                    setSelectedSlot(ms);
                    setStep('details');
                  }}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  isLoading={isLoadingAvailability}
                />
              ) : durations.length === 0 && !isFetchingAvailability ? (
                // The LINK publishes nothing at all — a different thing from a
                // fully-booked month, and the only case the escape hatch is
                // the right answer to.
                <div className="flex flex-col items-start gap-[var(--spacing-system-m)]">
                  <p className="text-ods-text-secondary text-h6">No call times are published right now.</p>
                  {escapeHatch}
                </div>
              ) : (
                // Pre-mount timezone-resolution window (every SSR load hits
                // this for one frame-batch) — same layout, real calendar, so
                // nothing shifts when the picker takes over.
                <SlotPickerSkeleton monthOffset={monthOffset} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  MeetingSchedulerDirectory,
  MeetingSchedulerDirectoryRowSkeleton,
  type MeetingSchedulerDirectoryProps,
} from './directory';
export type { MeetingAvailability, BookingConfirmation, MeetingBookingErrorCode, MeetingHost };
export type { SchedulingLink, SchedulingLinksPayload } from '../../schemas/meeting-booking-schema';
