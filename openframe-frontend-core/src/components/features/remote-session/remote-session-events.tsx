'use client';

import { cn } from '../../../utils/cn';
import type { RemoteSessionEvent } from './types';

/** `mm:ss` from the start of a recording; `h:mm:ss` from the first hour on. */
export function formatRemoteSessionOffset(offsetMs: number): string {
  const total = Math.max(0, Math.floor(offsetMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export interface RemoteSessionEventListProps {
  events: RemoteSessionEvent[];
  /** The event the playhead is on; highlighted. */
  activeEventId?: string | null;
  /** Seek the player to the event. */
  onSelect?: (event: RemoteSessionEvent) => void;
  className?: string;
}

/** SESSION EVENTS under the recording player: each event with its time, newest last. */
export function RemoteSessionEventList({ events, activeEventId, onSelect, className }: RemoteSessionEventListProps) {
  return (
    <section className={cn('flex w-full flex-col gap-[var(--spacing-system-xxs)]', className)}>
      <h2 className="text-ods-text-secondary text-h5">Session Events</h2>
      <ol className="flex w-full flex-col gap-[var(--spacing-system-xxs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        {events.map(event => (
          <li key={event.id}>
            <button
              type="button"
              aria-current={event.id === activeEventId || undefined}
              onClick={() => onSelect?.(event)}
              className={cn(
                'flex w-full items-start gap-[var(--spacing-system-xxs)] rounded-md p-[var(--spacing-system-xxs)] text-left outline-none transition-colors',
                'hover:bg-ods-bg-hover focus-visible:ring-2 focus-visible:ring-ods-focus',
                event.id === activeEventId && 'bg-ods-border hover:bg-ods-border',
              )}
            >
              <span className="w-[84px] shrink-0 text-ods-text-secondary text-h4">
                {formatRemoteSessionOffset(event.offsetMs)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-ods-text-primary text-h4">{event.title}</span>
                {event.detail && <span className="text-ods-text-secondary text-h6">{event.detail}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface RemoteSessionTimelineMarkersProps {
  events: RemoteSessionEvent[];
  /** Length of the recording; events past it are pinned to the end. */
  durationMs: number;
  /** Seek the player to the event. */
  onSelect?: (event: RemoteSessionEvent) => void;
  className?: string;
}

/** The event marks above the player's track, one per event, at its share of the recording. */
export function RemoteSessionTimelineMarkers({
  events,
  durationMs,
  onSelect,
  className,
}: RemoteSessionTimelineMarkersProps) {
  if (durationMs <= 0) return null;
  return (
    <div className={cn('relative h-4 w-full', className)}>
      {events.map(event => {
        const share = Math.min(1, Math.max(0, event.offsetMs / durationMs));
        const label = `${event.title} at ${formatRemoteSessionOffset(event.offsetMs)}`;
        return (
          <button
            key={event.id}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => onSelect?.(event)}
            style={{ left: `${share * 100}%` }}
            className="absolute top-0 h-4 w-1 -translate-x-1/2 rounded-md bg-ods-text-secondary outline-none transition-colors hover:bg-ods-text-primary focus-visible:ring-2 focus-visible:ring-ods-focus"
          />
        );
      })}
    </div>
  );
}
