import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { Button } from './button';

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

export interface PhoneNotificationProps {
  /** Small brand mark before the app label. */
  icon?: ReactNode;
  /** "Mingo · Needs you". */
  appLabel: string;
  /** "now". */
  timeLabel?: string;
  title: string;
  body?: string;
  /** Approve / Decline buttons, or the resolved line once it has been answered. */
  children?: ReactNode;
  className?: string;
}

/**
 * One lock-screen notification. Remount it (change its `key`) to replay the
 * drop-in; under reduced motion it simply appears.
 */
export function PhoneNotification({
  icon,
  appLabel,
  timeLabel,
  title,
  body,
  children,
  className,
}: PhoneNotificationProps) {
  return (
    <div
      className={cn(
        'rounded-[18px] border border-ods-border bg-ods-card p-3',
        'duration-[420ms] animate-in fade-in slide-in-from-top-6 motion-reduce:animate-none',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span className="grid h-[22px] w-[22px] shrink-0 place-items-center overflow-hidden rounded-md">{icon}</span>
        )}
        <span className="min-w-0 flex-1 truncate uppercase text-ods-text-secondary text-h6">{appLabel}</span>
        {timeLabel && <span className="shrink-0 text-ods-text-secondary text-h6">{timeLabel}</span>}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        <span className="font-bold text-ods-text-primary text-h6">{title}</span>
        {body && <span className="text-ods-text-secondary text-h6">{body}</span>}
      </div>
      {children}
    </div>
  );
}

export interface PhoneApprovalActionsProps {
  approveLabel: string;
  declineLabel: string;
  onApprove?: () => void;
  onDecline?: () => void;
  /** Shows the approve button in its pressed state (a scripted demo's beat before the answer). */
  approvePressed?: boolean;
  /** Make the buttons real controls (a visitor may tap them). Scripted otherwise. */
  interactive?: boolean;
  className?: string;
}

/**
 * The Decline / Approve pair inside a phone notification, each 44px tall.
 * Scripted by default (not focusable, no handlers fire); pass `interactive`
 * to let the visitor answer it.
 */
export function PhoneApprovalActions({
  approveLabel,
  declineLabel,
  onApprove,
  onDecline,
  approvePressed = false,
  interactive = false,
  className,
}: PhoneApprovalActionsProps) {
  // Scripted (not interactive): the pair is a picture of buttons, so it is
  // taken out of the tab order and hidden from assistive tech.
  const scripted = interactive ? {} : { tabIndex: -1, 'aria-hidden': true as const };
  return (
    <div className={cn('mt-2 flex gap-2', className)}>
      <Button
        variant="outline"
        font="regular"
        className="flex-1"
        onClick={interactive ? onDecline : undefined}
        {...scripted}
      >
        {declineLabel}
      </Button>
      <Button
        variant="inverted"
        font="regular"
        className="flex-1"
        aria-pressed={interactive ? undefined : approvePressed}
        data-pressed={approvePressed || undefined}
        onClick={interactive ? onApprove : undefined}
        {...scripted}
      >
        {approveLabel}
      </Button>
    </div>
  );
}

export interface PhoneNotificationResultProps {
  label: string;
  className?: string;
}

/** What a notification says once it was answered: a success check and one line. */
export function PhoneNotificationResult({ label, className }: PhoneNotificationResultProps) {
  return (
    <div
      className={cn(
        'mt-2 flex min-h-11 items-center gap-2 rounded-xl bg-ods-bg px-3 text-ods-text-primary duration-300 animate-in fade-in text-h6 motion-reduce:animate-none',
        className,
      )}
    >
      <CheckCircleIcon size={16} className="shrink-0 text-ods-success" aria-hidden />
      {label}
    </div>
  );
}
