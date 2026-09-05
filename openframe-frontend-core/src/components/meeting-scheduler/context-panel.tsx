'use client';

import { useMemo } from 'react';
import type { MeetingHost } from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import { formatDurationCompact } from '../../utils/format';
import { BackButton } from '../layout/back-button';
import { SquareAvatar, AvatarStack, Button, Skeleton, Autocomplete } from '../ui';

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
  /** Whether the timezone picker renders. Default true: the zone governs every
   *  time on screen, the form's summary line included, so it stays reachable
   *  right up to the confirmation — where there is nothing left to re-read. */
  showTimezone?: boolean;
  className?: string;
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
  'flex items-center justify-between gap-[var(--spacing-system-m)] lg:flex-col lg:items-stretch lg:gap-[var(--spacing-system-l)]';

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
const STRIP_BODY = 'flex flex-col gap-[var(--spacing-system-l)] md:flex-row md:items-start lg:flex-col';
const STRIP_MAIN = 'flex min-w-0 flex-col gap-[var(--spacing-system-l)] md:flex-1';
/** 280px — the same width this panel has as a sidebar, so the field is the
 *  size the visitor meets at every other breakpoint. */
const STRIP_ASIDE = 'flex flex-col gap-[var(--spacing-system-xxs)] md:w-[280px] md:shrink-0 lg:w-full';

/** The back affordance sits flush with the panel's top padding: `BackButton`'s
 *  own 12px block padding would otherwise double the 24px stack gap under it. */
const BACK_BUTTON_CLASS = 'py-0';

/** Field labels ("Duration", "Timezone") — body-weight primary, 4px above
 *  their control, so the panel reads as a form rather than as a stack of
 *  section headers. */
const FIELD_LABEL_CLASS = 'text-h4 text-ods-text-primary';

function zoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offset = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    return offset ? `${tz.replace(/_/g, ' ')} (${offset})` : tz.replace(/_/g, ' ');
  } catch {
    return tz.replace(/_/g, ' ');
  }
}

/**
 * Same-footprint skeleton — swaps with the loaded panel with zero shift.
 * STATIC labels ("Duration", "Timezone") render REAL; only data-driven
 * content (host identity, duration chips, the zone value) is skeleton.
 */
export function ContextPanelSkeleton({
  className,
  onBack,
  backLabel = 'Back',
}: {
  className?: string;
  onBack?: () => void;
  backLabel?: string;
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
            <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)] lg:flex-none">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-[var(--spacing-system-xxs)]">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        </div>
        <div className={STRIP_ASIDE}>
          <p className={FIELD_LABEL_CLASS}>Timezone</p>
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
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
  onBack,
  backLabel = 'Back',
  locked = false,
  showTimezone = true,
  className,
}: SchedulerContextPanelProps) {
  // All IANA zones with live GMT offsets — computed once, client-only (the
  // panel renders the picker only after the parent resolves a zone).
  const zoneOptions = useMemo(() => {
    if (!timezone) return [];
    let zones: string[];
    try {
      // Older lib targets don't type supportedValuesOf (ES2022) — runtime-guarded.
      const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
      zones = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [timezone];
    } catch {
      zones = [timezone];
    }
    if (!zones.includes(timezone)) zones = [timezone, ...zones];
    return zones.map(tz => ({ value: tz, label: zoneLabel(tz) }));
  }, [timezone]);

  return (
    <div className={cn(PANEL_STACK, className)}>
      {/* The card's ONE back edge, at every step — the caller decides where it
          goes (previous step, or out of the scheduler). It sits in this panel
          because this is the half that never swaps. */}
      {onBack && <BackButton label={backLabel} onClick={onBack} className={BACK_BUTTON_CLASS} />}

      <div className={STRIP_BODY}>
        <div className={STRIP_MAIN}>
          <div className={IDENTITY_ROW}>
            {/* Host identity: full rows up to 3 hosts; larger teams (round-robin
                links can carry many members) collapse to a stacked-avatar cluster
                + count so the panel can never overflow. */}
            {hosts.length > 0 && hosts.length <= 3 && (
              <div className="flex flex-col gap-[var(--spacing-system-s)]">
                {hosts.map(host => (
                  <div key={host.name} className="flex items-center gap-[var(--spacing-system-xs)]">
                    <SquareAvatar
                      variant="round"
                      size="sm"
                      src={host.avatarUrl ?? undefined}
                      alt={host.name}
                      fallback={host.name}
                    />
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-ods-text-primary text-h4">{host.name}</p>
                      {host.title && <p className="truncate text-ods-text-secondary text-h6">{host.title}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hosts.length > 3 && (
              <div className="flex flex-col gap-[var(--spacing-system-xs)]">
                <AvatarStack people={hosts} max={4} size="lg" />
                <p className="text-ods-text-secondary text-h6">{hosts.length} hosts on this calendar</p>
              </div>
            )}

            {locked || durationsMs.length <= 1
              ? // Post-selection, or a link that offers one length: a static line,
                // which is what sits beside the host on the header-strip layouts.
                selectedDurationMs != null && (
                  <p className="shrink-0 text-ods-text-secondary text-h6">
                    {formatDurationCompact(selectedDurationMs / 1000)} call
                  </p>
                )
              : null}
          </div>

          {title && <p className="text-ods-text-primary text-h3">{title}</p>}
          {description && <p className="text-ods-text-secondary text-h6">{description}</p>}

          {/* Several lengths on offer: chips, which need a full row of their
              own at every width — so they stay OUT of the identity row. */}
          {!locked && durationsMs.length > 1 && (
            <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <p className={FIELD_LABEL_CLASS}>Duration</p>
              <div className="flex flex-wrap gap-[var(--spacing-system-xs)]">
                {durationsMs.map(ms => (
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
          )}
        </div>

        {showTimezone && (
          // Once a slot is chosen the picker is desktop-only, which is what all
          // three mocks draw. On the narrow layouts this panel is a strip
          // COMPETING with the form for the screen's height, and the step's own
          // summary line states the zone one row below — so the fact survives,
          // only the control steps aside. The 280px sidebar has the room, so
          // there it stays.
          <div className={cn(STRIP_ASIDE, locked && 'max-lg:hidden')}>
            <p className={FIELD_LABEL_CLASS}>Timezone</p>
            {timezone ? (
              <Autocomplete
                value={timezone}
                onChange={tz => {
                  if (tz) onTimezoneChange?.(tz);
                }}
                options={zoneOptions}
                placeholder="Search timezone…"
                noOptionsText="No matching timezone"
                showClearAll={false}
              />
            ) : (
              <Skeleton className="h-12 w-full" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
