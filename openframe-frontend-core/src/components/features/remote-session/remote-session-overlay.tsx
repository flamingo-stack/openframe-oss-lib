'use client';

import { cn } from '../../../utils/cn';
import { MonitorOffIcon } from '../../icons-v2-generated';

/*
 * The always-visible "your screen is being controlled" indicator: a border
 * around the screen and an End Session pill hanging from its top edge.
 * The colour is the ODS warning token, not the accent: the accent follows
 * tenant branding, and this indicator must stay a recognisable fixed yellow.
 */

/** The warning-yellow frame drawn around a whole screen; it never takes pointer events. */
export function RemoteSessionBorder({ className }: { className?: string }) {
  return <div className={cn('pointer-events-none size-full border-4 border-ods-warning', className)} />;
}

/**
 * The End Session pill. It sits flush against the top edge of the screen, so
 * only its bottom corners are rounded and it reads as one piece with the border.
 */
export function RemoteSessionPill({ onEndSession }: { onEndSession: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center gap-[var(--spacing-system-xsf)] rounded-b-md bg-ods-warning px-[var(--spacing-system-m)] py-[var(--spacing-system-xs)] text-ods-text-on-accent"
      onClick={onEndSession}
    >
      <MonitorOffIcon size={24} color="currentColor" />
      <span className="whitespace-nowrap text-h3">End Session</span>
    </button>
  );
}
