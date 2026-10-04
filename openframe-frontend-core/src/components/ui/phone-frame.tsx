import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface PhoneFrameProps {
  /** Lock-screen date line, e.g. "Thursday, October 1". */
  dateLabel?: string;
  /** Lock-screen clock, e.g. "5:09". */
  timeLabel?: string;
  /** The notification slot at the bottom of the lock screen. One at a time. */
  children?: ReactNode;
  className?: string;
}

/**
 * A phone lock screen: island, date, clock and one notification slot pinned
 * to the bottom. Decorative chrome for showing what lands on a phone.
 *
 * It is sized by its class (default 236 x 480), never scaled, so the text
 * inside stays the size the page set.
 */
export function PhoneFrame({ dateLabel, timeLabel, children, className }: PhoneFrameProps) {
  return (
    <div
      className={cn('h-[480px] w-[236px] shrink-0 rounded-[44px] border border-ods-border bg-black p-2.5', className)}
    >
      <div className="flex h-full flex-col items-center rounded-[36px] bg-ods-bg px-2.5 py-3.5">
        <span className="h-6 w-20 rounded-full bg-black" aria-hidden />
        {dateLabel && <span className="mt-4 text-ods-text-secondary text-h6">{dateLabel}</span>}
        {timeLabel && (
          <span className="mb-auto text-[56px] font-medium leading-[60px] tracking-tight text-ods-text-primary">
            {timeLabel}
          </span>
        )}
        <div className={cn('flex w-full flex-col gap-1.5', !timeLabel && 'mt-auto')}>{children}</div>
      </div>
    </div>
  );
}
