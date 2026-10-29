'use client';

import { cn } from '../../../utils/cn';
import { AlertTriangleIcon, LockIcon } from '../../icons-v2-generated';
import { Tag } from '../../ui/tag';
import type { RemoteSessionStatus } from './types';

/** The pulsing dot of the LIVE tag; still when the user asks for reduced motion. */
function LiveDot() {
  return <span aria-hidden className="size-2 animate-live-pulse rounded-full bg-current motion-reduce:animate-none" />;
}

const STATUS_TAG: Record<RemoteSessionStatus, { label: string; variant: 'critical' | 'warning' | 'error' }> = {
  live: { label: 'Live', variant: 'critical' },
  processing: { label: 'Processing', variant: 'warning' },
  failed: { label: 'Failed', variant: 'error' },
};

export interface RemoteSessionStatusTagProps {
  status: RemoteSessionStatus;
  className?: string;
}

/** LIVE / PROCESSING / FAILED beside a session's date in the session list and on its page. */
export function RemoteSessionStatusTag({ status, className }: RemoteSessionStatusTagProps) {
  const { label, variant } = STATUS_TAG[status];
  return (
    <Tag
      label={label}
      variant={variant}
      icon={status === 'live' ? <LiveDot /> : undefined}
      className={cn('pointer-events-none shrink-0', className)}
    />
  );
}

export type RemoteSessionExpiryProps = { className?: string } & (
  | { state: 'kept'; keptBy: string; reason: string }
  | { state: 'scheduled'; date: string; remaining?: string | null }
  | { state: 'expired' }
  | { state: 'none' }
);

/** The EXPIRES cell of a recording: its expiry date, the Keep holding it, or that it has expired. */
export function RemoteSessionExpiry(props: RemoteSessionExpiryProps) {
  const { className } = props;
  if (props.state === 'none') {
    return <p className={cn('text-ods-text-primary text-h4', className)}>-</p>;
  }
  if (props.state === 'expired') {
    return <p className={cn('text-ods-text-secondary text-h4', className)}>Expired</p>;
  }
  if (props.state === 'kept') {
    return (
      <div className={cn('flex min-w-0 flex-col', className)}>
        <p className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-primary text-h4">
          <LockIcon size={24} color="currentColor" className="shrink-0" />
          Kept
        </p>
        <p className="truncate text-ods-text-secondary text-h6">
          Kept by {props.keptBy} · {props.reason}
        </p>
      </div>
    );
  }
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <p className="text-ods-text-primary text-h4">{props.date}</p>
      {props.remaining && <p className="truncate text-ods-text-secondary text-h6">{props.remaining}</p>}
    </div>
  );
}

export interface RemoteSessionStorageAlertProps {
  /** `device` on the device page (new sessions there aren't recorded); `session` on a running session. */
  scope: 'device' | 'session';
  /** The plan's recording storage, e.g. "100 GB"; named on the device page. */
  capacity?: string | null;
  className?: string;
}

/** The banner shown while the tenant's recording storage is full. */
export function RemoteSessionStorageAlert({ scope, capacity, className }: RemoteSessionStorageAlertProps) {
  const message =
    scope === 'session'
      ? "This session isn't being recorded. Recording storage is full. New sessions aren't recorded until space is freed."
      : `Recording storage full. New sessions aren't recorded.${
          capacity ? ` All ${capacity} of recording storage is used.` : ''
        }`;
  return (
    <div
      role="alert"
      className={cn(
        'flex w-full items-start gap-[var(--spacing-system-m)] rounded-md bg-ods-warning-secondary p-[var(--spacing-system-s)] text-ods-warning',
        className,
      )}
    >
      <AlertTriangleIcon size={24} color="currentColor" className="shrink-0" />
      <p className="min-w-0 flex-1 text-h3">{message}</p>
    </div>
  );
}
