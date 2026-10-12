'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { DEVICE_WALLPAPER_CLASS } from './device-wallpaper';
import { LockCameraGlyph, LockFlashlightGlyph, StatusBarGlyphs } from './phone-frame-glyphs';

export interface PhoneFrameProps {
  /** A fixed lock-screen date line ("Thursday, October 1"). Omitted, it is today's, in the visitor's own locale. */
  dateLabel?: string;
  /** A fixed lock-screen clock ("5:09"). Omitted, it is the visitor's own time, kept current. */
  timeLabel?: string;
  /** The notifications, at the foot of the screen where a phone keeps them (`NotificationStack`). */
  children?: ReactNode;
  className?: string;
}

/** How often the clock is re-read. The label only changes with the minute, so most readings change nothing. */
const CLOCK_TICK_MS = 1000;

function subscribeToClock(onTick: () => void): () => void {
  const timer = setInterval(onTick, CLOCK_TICK_MS);
  return () => clearInterval(timer);
}

/** "9:41": the hour and minute as a lock screen shows them, with no AM/PM. */
function readClock(): string {
  const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')}`;
}

/** "Monday, October 12". */
function readDate(): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

// The server cannot know the visitor's time: it (and the hydrating render) draw none, in the same box.
const noTime = () => '';

/** One of the lock screen's two round shortcuts. A drawing: it does nothing. */
function LockShortcut({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-[34px] place-items-center rounded-full bg-ods-text-primary/35 text-ods-text-primary backdrop-blur-md">
      {children}
    </span>
  );
}

/**
 * A phone lock screen: the status bar and island, the date and clock on the
 * device wallpaper (`DEVICE_WALLPAPER_CLASS`, the one every drawn device
 * shares), the notifications stacked at the foot of the screen, then the two
 * shortcuts and the home indicator. Decorative chrome for showing what lands
 * on a phone.
 *
 * The clock is REAL: the visitor's own date and time, kept current, unless a
 * caller fixes them. The server draws neither (it cannot know them); their
 * lines keep their height, so nothing moves when they appear.
 *
 * It is sized by its class (default 299 x 617), never scaled, so the text
 * inside stays the size the page set.
 */
export function PhoneFrame({ dateLabel, timeLabel, children, className }: PhoneFrameProps) {
  const liveTime = useSyncExternalStore(subscribeToClock, readClock, noTime);
  const liveDate = useSyncExternalStore(subscribeToClock, readDate, noTime);
  const time = timeLabel ?? liveTime;
  const date = dateLabel ?? liveDate;
  return (
    <div
      className={cn('h-[617px] w-[299px] shrink-0 rounded-[48px] border border-ods-border bg-black p-2.5', className)}
    >
      <div className={cn('relative flex h-full flex-col overflow-hidden rounded-[38px]', DEVICE_WALLPAPER_CLASS)}>
        <div
          className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5 pt-2.5 text-ods-text-primary"
          aria-hidden
        >
          <span className="font-semibold tabular-nums text-h6">{time}</span>
          <span className="h-6 w-20 rounded-full bg-black" />
          <StatusBarGlyphs className="h-2.5 w-[54px] justify-self-end" />
        </div>
        <div className="flex shrink-0 flex-col items-center pt-4 text-ods-text-primary">
          <span className="min-h-[var(--font-line-space-h4-body)] text-h4">{date}</span>
          <span className="h-[68px] text-[64px] font-bold tabular-nums leading-[68px] tracking-tight">{time}</span>
        </div>
        {/* Clipped at the top: a stack taller than the screen never runs over the clock. */}
        <div className="flex min-h-0 w-full flex-1 flex-col justify-end overflow-hidden px-2.5 pb-3 pt-2">
          {children}
        </div>
        <div className="flex shrink-0 items-center justify-between px-8" aria-hidden>
          <LockShortcut>
            <LockFlashlightGlyph className="size-[34px]" />
          </LockShortcut>
          <LockShortcut>
            <LockCameraGlyph className="size-[34px]" />
          </LockShortcut>
        </div>
        <span className="mx-auto mb-2 mt-3 h-1 w-24 shrink-0 rounded-full bg-ods-text-primary" aria-hidden />
      </div>
    </div>
  );
}
