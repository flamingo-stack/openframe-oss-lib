'use client';

import type { MeetingHost } from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import { formatDurationCompact } from '../../utils/format';
import { BackButton } from '../layout/back-button';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui';
import { LOADING_NOOP, LoadingItems, useLoadingScope } from '../ui/loading-scope';
import { TimezoneSelect } from '../ui/timezone-select';
import { HostIdentity } from './host-identity';

/** The skeleton's timezone picker is drawn in its loading form, where nothing can be picked. */

/**
 * ContextPanel — the "who / what / how long" side of the scheduler card
 * (Calendly-anatomy left panel; stacks on top on mobile). Everything here is
 * trust surface: host identity (avatar + name + title), the meeting's own
 * title/description, the duration (chips when the link offers several — the
 * duration choice lives HERE, not as a separate wizard step), and a
 * SEARCHABLE timezone picker (all IANA zones with live GMT offsets;
 * rendering-only — the wire is always epoch-ms).
 *
 * `onBack` (optional) puts the card's ONE back edge at the TOP of this panel —
 * the one spot that stays put while the action side swaps between calendar,
 * form and confirmation. What it means is the caller's call: the scheduler
 * points it at the previous STEP from the form, and at the host's own exit
 * from the calendar. One affordance, one place, so the visitor never has to
 * work out which of two "Back"s goes where.
 *
 * The picker renders only once the parent resolves the zone post-mount — SSR
 * output stays deterministic; a same-footprint skeleton holds the space.
 */

export interface SchedulerContextPanelProps {
  hosts: MeetingHost[];
  title?: string;
  description?: string | null;
  durationsMs: number[];
  selectedDurationMs: number | null;
  onSelectDuration: (ms: number) => void;
  /** Resolved IANA zone (null until the client resolves it). */
  timezone: string | null;
  onTimezoneChange?: (tz: string) => void;
  /** Host-level exit (renders a `BackButton` at the top). Omitted → no back
   *  affordance, which is what an embedder with its own page chrome wants. */
  onBack?: () => void;
  /** Label for {@link onBack}. */
  backLabel?: string;
  /** True once a slot is chosen (details/confirmed steps) — the duration
   *  CHIPS give way to a static duration line, since the step summary already
   *  states the length and a live selector beside a filled-in form invites a
   *  change that would throw the form away. Going Back restores them. */
  locked?: boolean;
  /** A POST is in flight: the duration chips and the zone control stay MOUNTED
   *  (nothing may shift under the spinning chip) but accept no input. */
  disabled?: boolean;
  /** Whether the timezone picker renders. Default true: the zone governs every
   *  time on screen, the form's summary line included, so it stays reachable
   *  right up to the confirmation — where there is nothing left to re-read. */
  showTimezone?: boolean;
  className?: string;
  /** The meeting is still being read: the panel draws its own skeleton, as in a loading scope. */
  loading?: boolean;
}

/** Panel stack — one rhythm shared by the loaded panel and its skeleton
 *  (16px on phones, 24px from tablet up, via the responsive spacing token). */
const PANEL_STACK = 'flex flex-col gap-[var(--spacing-system-l)]';

/**
 * Identity + duration: ONE line below `lg`, stacked from `lg` up.
 *
 * The panel is a 280px sidebar from `lg` and a full-width header strip below
 * it — and a header strip has horizontal room the sidebar never had, so the
 * duration moves up beside the host instead of taking a line of its own. Same
 * two children, different axis; nothing is hidden at any width.
 */
const IDENTITY_ROW =
  'flex items-center justify-between gap-[var(--spacing-system-m)] content-lg:flex-col content-lg:items-stretch content-lg:gap-[var(--spacing-system-l)]';

/**
 * Everything under the back edge, in TWO groups: identity/title/duration, and
 * the timezone field beside them.
 *
 * Side by side only on TABLET. There the panel is a full-width strip over the
 * calendar, and it is competing with the calendar for the card's height — a
 * timezone field on a line of its own costs 100px there, which is a third of
 * what the month needs to render without scrolling. Sideways it costs nothing:
 * the strip is ~725px wide and the identity block uses less than half of it.
 *
 * Below `md` (phone) and from `lg` up (280px sidebar) there is no horizontal
 * room to spend, so both fall back to the plain stack.
 */
const STRIP_BODY =
  'flex flex-col gap-[var(--spacing-system-l)] content-md:flex-row content-md:items-start content-lg:flex-col';
const STRIP_MAIN = 'flex min-w-0 flex-col gap-[var(--spacing-system-l)] content-md:flex-1';
/** 280px — the same width this panel has as a sidebar, so the field is the
 *  size the visitor meets at every other breakpoint. */
const STRIP_ASIDE =
  'flex flex-col gap-[var(--spacing-system-xxs)] content-md:w-[280px] content-md:shrink-0 content-lg:w-full';

/** The back affordance sits flush with the panel's top padding: `BackButton`'s
 *  own 12px block padding would otherwise double the 24px stack gap under it. */
const BACK_BUTTON_CLASS = 'py-0';

/** Field labels ("Duration", "Timezone") — body-weight primary, 4px above
 *  their control, so the panel reads as a form rather than as a stack of
 *  section headers. */
const FIELD_LABEL_CLASS = 'text-h4 text-ods-text-primary';

/** The static duration line beside the host. */
const DURATION_LINE_CLASS = 'shrink-0 text-ods-text-secondary text-h6';
/** The "Duration" field and its chips row. */
const DURATION_FIELD_CLASS = 'flex flex-col gap-[var(--spacing-system-xxs)]';
const DURATION_CHIPS_CLASS = 'flex flex-wrap gap-[var(--spacing-system-xs)]';
/** After a slot is chosen the timezone field is drawn only on the 280px sidebar (from `lg`). */
const TIMEZONE_WIDE_ONLY_CLASS = 'content-max-lg:hidden';

/**
 * Same-footprint skeleton — swaps with the loaded panel with zero shift.
 * STATIC labels ("Duration", "Timezone") render REAL; only data-driven
 * content (host identity, duration chips, the zone value) is skeleton.
 */
function ContextPanelSkeleton({
  className,
  onBack,
  backLabel = 'Back',
  title = true,
  description = true,
  durations = 0,
  timezone = 'shown',
}: {
  className?: string;
  onBack?: () => void;
  backLabel?: string;
  /** The loaded panel has the meeting's title line (a bar of it). Default true: a scheduling link has a title. */
  title?: boolean;
  /** The loaded panel has the meeting's description line (a bar of it). Default true. */
  description?: boolean;
  /**
   * How many duration chips the loaded panel offers: more than 1 draws the "Duration" row, otherwise the static
   * duration line beside the host (every link states its length, as chips or as that line). Default 0.
   */
  durations?: number;
  /**
   * The timezone field, as the loaded panel draws it: `shown`, `wide` (only from `lg`, after a slot is chosen) or
   * `hidden` (the confirmation). Default `shown`.
   */
  timezone?: 'shown' | 'wide' | 'hidden';
}) {
  return (
    <div className={cn(PANEL_STACK, className)}>
      {/* The back edge renders REAL here — it needs no data, and holding the
          space with a bar would just move on load. */}
      {onBack && <BackButton label={backLabel} onClick={onBack} className={BACK_BUTTON_CLASS} />}
      {/* Same two groups, same rows, as the loaded panel — so the header strip
          keeps its height and nothing re-flows when it swaps in. */}
      <div className={STRIP_BODY}>
        <div className={STRIP_MAIN}>
          <div className={IDENTITY_ROW}>
            <HostIdentity hosts={[]} loading />
            {durations <= 1 && <TextLineSkeleton type="h6" className="w-20 shrink-0" />}
          </div>
          {title && <TextLineSkeleton type="h3" className="w-3/5" />}
          {description && <TextLineSkeleton type="h6" className="w-4/5" />}
          {durations > 1 && (
            <div className={DURATION_FIELD_CLASS}>
              <p className={FIELD_LABEL_CLASS}>Duration</p>
              <div className={DURATION_CHIPS_CLASS}>
                <LoadingItems count={durations}>
                  {() => <InteractiveSkeleton.Button data-loading-item size="small-legacy" className="w-16" />}
                </LoadingItems>
              </div>
            </div>
          )}
        </div>
        {timezone !== 'hidden' && (
          <div className={cn(STRIP_ASIDE, timezone === 'wide' && TIMEZONE_WIDE_ONLY_CLASS)}>
            <p className={FIELD_LABEL_CLASS}>Timezone</p>
            <TimezoneSelect value={null} loading onChange={LOADING_NOOP} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * How many lengths the panel's skeleton offers while the link is read and its lengths are not known yet: a scheduling
 * link typically offers more than one (a short and a long call), so the skeleton draws the "Duration" row of chips.
 */
const CONTEXT_PANEL_TYPICAL_DURATIONS = 2;

export function SchedulerContextPanel({
  hosts,
  title,
  description,
  durationsMs,
  selectedDurationMs,
  onSelectDuration,
  timezone,
  onTimezoneChange,
  onBack,
  backLabel = 'Back',
  locked = false,
  disabled = false,
  showTimezone = true,
  className,
  loading = false,
}: SchedulerContextPanelProps) {
  // While the meeting is read the panel is its skeleton (the hosts, title and durations are read data).
  if (useLoadingScope() || loading) {
    return (
      <ContextPanelSkeleton
        onBack={onBack}
        backLabel={backLabel}
        title={title !== undefined}
        description={description !== undefined && description !== null}
        durations={locked ? 0 : durationsMs.length || CONTEXT_PANEL_TYPICAL_DURATIONS}
        timezone={showTimezone ? (locked ? 'wide' : 'shown') : 'hidden'}
        className={className}
      />
    );
  }

  return (
    <div className={cn(PANEL_STACK, className)}>
      {/* The card's ONE back edge, at every step — the caller decides where it
          goes (previous step, or out of the scheduler). It sits in this panel
          because this is the half that never swaps. */}
      {onBack && <BackButton label={backLabel} onClick={onBack} className={BACK_BUTTON_CLASS} />}

      <div className={STRIP_BODY}>
        <div className={STRIP_MAIN}>
          <div className={IDENTITY_ROW}>
            <HostIdentity hosts={hosts} />

            {locked || durationsMs.length <= 1
              ? // Post-selection, or a link that offers one length: a static line,
                // which is what sits beside the host on the header-strip layouts.
                selectedDurationMs != null && (
                  <p className={DURATION_LINE_CLASS}>{formatDurationCompact(selectedDurationMs / 1000)} call</p>
                )
              : null}
          </div>

          {title && <p className="text-ods-text-primary text-h3">{title}</p>}
          {description && <p className="text-ods-text-secondary text-h6">{description}</p>}

          {/* Several lengths on offer: chips, which need a full row of their
              own at every width — so they stay OUT of the identity row. */}
          {!locked && durationsMs.length > 1 && (
            <div className={DURATION_FIELD_CLASS}>
              <p className={FIELD_LABEL_CLASS}>Duration</p>
              <div className={DURATION_CHIPS_CLASS}>
                {durationsMs.map(ms => (
                  <Button
                    key={ms}
                    data-loading-item
                    variant={selectedDurationMs === ms ? undefined : 'outline'}
                    size="small-legacy"
                    disabled={disabled}
                    onClick={() => onSelectDuration(ms)}
                  >
                    {formatDurationCompact(ms / 1000)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showTimezone && (
          // Once a slot is chosen the picker is desktop-only, which is what all
          // three mocks draw. On the narrow layouts this panel is a strip
          // COMPETING with the form for the screen's height, and the step's own
          // summary line states the zone one row below — so the fact survives,
          // only the control steps aside. The 280px sidebar has the room, so
          // there it stays.
          <div className={cn(STRIP_ASIDE, locked && TIMEZONE_WIDE_ONLY_CLASS)}>
            <p className={FIELD_LABEL_CLASS}>Timezone</p>
            {/* Until the visitor's zone is known the picker draws its own skeleton (`loading`). */}
            <TimezoneSelect
              value={timezone ?? null}
              loading={!timezone}
              disabled={disabled}
              onChange={tz => {
                if (tz) onTimezoneChange?.(tz);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
