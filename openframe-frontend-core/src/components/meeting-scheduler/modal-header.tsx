'use client';

import type { MeetingHost } from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import { formatDurationCompact } from '../../utils/format';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui';
import { LOADING_NOOP, useLoadingScope } from '../ui/loading-scope';
import { TimezoneSelect } from '../ui/timezone-select';
import { HostIdentity } from './host-identity';

/** The skeleton's timezone picker is drawn in its loading form, where nothing can be picked. */

/**
 * The head of the scheduler's MODAL layout: the host strip (who, and how long
 * on its right - chips when the link offers several lengths, the length alone
 * otherwise) and the timezone row under it, each cut off by a rule. The
 * context panel's facts in the window's own arrangement: there is no side
 * column in a 600px box, so the strip sits over the calendar and the zone
 * picker spans the width above it, at every size.
 */
export interface SchedulerModalHeaderProps {
  hosts: MeetingHost[];
  durationsMs: number[];
  selectedDurationMs: number | null;
  onSelectDuration: (ms: number) => void;
  /** Resolved IANA zone (null until the client resolves it). */
  timezone: string | null;
  onTimezoneChange?: (tz: string) => void;
  /** A slot is chosen: the length is settled, the chips give way to the line. */
  locked?: boolean;
  disabled?: boolean;
  /** Whether the timezone row renders (not on the confirmation). */
  showTimezone?: boolean;
  /** The meeting is read on the client and has not arrived: the header draws its skeleton, as in a loading scope. */
  loading?: boolean;
}

const ROW_CLASS = 'border-b border-ods-border p-[var(--spacing-system-m)]';
const STRIP_CLASS = cn(ROW_CLASS, 'flex items-center justify-between gap-[var(--spacing-system-m)]');
const FIELD_LABEL_CLASS = 'text-h4 text-ods-text-primary';
const TIMEZONE_ROW_CLASS = cn(ROW_CLASS, 'flex flex-col gap-[var(--spacing-system-xxs)]');
const DURATION_LINE_CLASS = 'shrink-0 text-ods-text-secondary text-h6';

export function SchedulerModalHeader({
  hosts,
  durationsMs,
  selectedDurationMs,
  onSelectDuration,
  timezone,
  onTimezoneChange,
  locked = false,
  disabled = false,
  showTimezone = true,
  loading = false,
}: SchedulerModalHeaderProps) {
  const chips = !locked && durationsMs.length > 1;
  // While the meeting is read the header is its skeleton (the hosts and durations are read data).
  if (useLoadingScope() || loading) return <SchedulerModalHeaderSkeleton showTimezone={showTimezone} />;
  return (
    <>
      <div className={STRIP_CLASS}>
        <HostIdentity hosts={hosts} />
        {chips ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-[var(--spacing-system-xs)]">
            {durationsMs.map(ms => (
              <Button
                key={ms}
                variant={selectedDurationMs === ms ? undefined : 'outline'}
                size="small-legacy"
                disabled={disabled}
                onClick={() => onSelectDuration(ms)}
              >
                {formatDurationCompact(ms / 1000)}
              </Button>
            ))}
          </div>
        ) : (
          selectedDurationMs != null && (
            <p className={DURATION_LINE_CLASS}>{formatDurationCompact(selectedDurationMs / 1000)} call</p>
          )
        )}
      </div>
      {showTimezone && (
        <div className={TIMEZONE_ROW_CLASS}>
          <p className={FIELD_LABEL_CLASS}>Timezone</p>
          {/* The zone resolves after mount: until then the picker draws its own skeleton. */}
          <TimezoneSelect
            value={timezone}
            loading={!timezone}
            disabled={disabled}
            onChange={tz => {
              if (tz) onTimezoneChange?.(tz);
            }}
          />
        </div>
      )}
    </>
  );
}

/** Same footprint as the loaded header, for the cold load: "Timezone" real, one host and the length as bars. */
export function SchedulerModalHeaderSkeleton({ showTimezone = true }: { showTimezone?: boolean } = {}) {
  return (
    <>
      <div className={STRIP_CLASS}>
        <HostIdentity hosts={[]} loading />
        <TextLineSkeleton type="h6" className={cn(DURATION_LINE_CLASS, 'w-20')} />
      </div>
      {showTimezone && (
        <div className={TIMEZONE_ROW_CLASS}>
          <p className={FIELD_LABEL_CLASS}>Timezone</p>
          <TimezoneSelect value={null} loading onChange={LOADING_NOOP} />
        </div>
      )}
    </>
  );
}
