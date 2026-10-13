'use client';

import type { MeetingHost } from '../../schemas/meeting-booking-schema';
import { cn } from '../../utils/cn';
import { formatDurationCompact } from '../../utils/format';
import { SquareAvatar, AvatarStack, Button, Skeleton } from '../ui';
import { TimezoneSelect } from '../ui/timezone-select';

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
}

const ROW_CLASS = 'border-b border-ods-border p-[var(--spacing-system-l)]';
const STRIP_CLASS = cn(ROW_CLASS, 'flex items-center justify-between gap-[var(--spacing-system-m)]');
const FIELD_LABEL_CLASS = 'text-h4 text-ods-text-primary';

function HostIdentity({ hosts }: { hosts: MeetingHost[] }) {
  if (hosts.length === 0) return null;
  if (hosts.length > 3) {
    return (
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <AvatarStack people={hosts} max={4} size="lg" label="Hosts" />
        <p className="text-ods-text-secondary text-h6">{hosts.length} hosts on this calendar</p>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-s)]">
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
  );
}

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
}: SchedulerModalHeaderProps) {
  const chips = !locked && durationsMs.length > 1;
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
            <p className="shrink-0 text-ods-text-secondary text-h6">
              {formatDurationCompact(selectedDurationMs / 1000)} call
            </p>
          )
        )}
      </div>
      {showTimezone && (
        <div className={cn(ROW_CLASS, 'flex flex-col gap-[var(--spacing-system-xxs)]')}>
          <p className={FIELD_LABEL_CLASS}>Timezone</p>
          {timezone ? (
            <TimezoneSelect
              value={timezone}
              disabled={disabled}
              onChange={tz => {
                if (tz) onTimezoneChange?.(tz);
              }}
            />
          ) : (
            <Skeleton className="h-12 w-full" />
          )}
        </div>
      )}
    </>
  );
}

/** Same footprint as the loaded header, for the cold load. */
export function SchedulerModalHeaderSkeleton() {
  return (
    <>
      <div className={STRIP_CLASS}>
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-20 shrink-0" />
      </div>
      <div className={cn(ROW_CLASS, 'flex flex-col gap-[var(--spacing-system-xxs)]')}>
        <p className={FIELD_LABEL_CLASS}>Timezone</p>
        <Skeleton className="h-12 w-full" />
      </div>
    </>
  );
}
