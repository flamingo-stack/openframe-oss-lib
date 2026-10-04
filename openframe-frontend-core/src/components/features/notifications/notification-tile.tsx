'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from '../../../embed-shims/next-image';
import { cn } from '../../../utils/cn';
import { formatTicketRelativeTime } from '../../../utils/date-utils';
import { CheckCircleIcon } from '../../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { XmarkIcon } from '../../icons-v2-generated/signs-and-symbols/xmark-icon';
import { dotColorByVariant, progressColorByVariant as toastProgressColorByVariant } from '../../ui/toaster';
import type { Notification, NotificationSeverity, NotificationVariant } from './types';

/** Backend severity → tile color variant; overrides `notification.variant` when present. */
const variantBySeverity: Record<NotificationSeverity, NotificationVariant> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'error',
};

/** Severity color applied to the header type label and icon slot. */
const typeColorByVariant: Record<NotificationVariant, string> = {
  default: 'text-ods-text-secondary',
  info: 'text-ods-text-secondary',
  success: 'text-ods-success',
  warning: 'text-ods-warning',
  error: 'text-ods-error',
};

/**
 * The live countdown bar. The attention variants keep their colour; the neutral card's bar
 * is the brand accent (Figma `notification-card`: `open-colors/yellow`), not the grey the
 * toast draws. A toast's bar only times out; a card's says "new, still live" in a drawer of
 * settled grey rows, so it needs the accent to read at all. The dot keeps the toast colours.
 */
const progressColorByVariant: Record<NotificationVariant, string> = {
  ...toastProgressColorByVariant,
  default: 'bg-ods-accent',
  info: 'bg-ods-accent',
};

const headerControlClass =
  'absolute inset-0 flex items-center justify-center text-ods-text-secondary transition-opacity duration-200 hover:text-ods-text-primary';

export interface NotificationTileProps {
  notification: Notification;
  liveDurationMs?: number;
  onComplete: (id: string) => void;
  onSettle?: (id: string) => void;
  className?: string;
  /** Action row rendered below the body inside the padded section (e.g. approval buttons). */
  actions?: ReactNode;
  /**
   * Extra content rendered below the padded section (e.g. a collapsible approval command
   * section). Bring your own top divider — the tile no longer draws one, so a zero-height
   * collapsed child doesn't leave a stray border above the card's bottom edge.
   */
  children?: ReactNode;
  /** Pin the tile: cancel the live auto-dismiss countdown (timer + progress bar) without settling it. */
  paused?: boolean;
  /**
   * Lines the title may take before it is cut with an ellipsis. `1` (default)
   * keeps drawer rows one height; a narrow host that cannot widen (a
   * watch-face mock, a side rail) passes `2` so the title is read, not cut.
   */
  titleLines?: 1 | 2;
  /**
   * `card` (default): the app's own tile, with its uppercase type label and the
   * dismiss / complete control.
   * `lockscreen`: the same notification as a phone shows it: the app's mark and
   * a plain, sentence-case label that is never cut short, the time, no in-app
   * control, phone-sized corners. For a phone or watch mock.
   */
  presentation?: 'card' | 'lockscreen';
}

export function NotificationTile({
  notification,
  liveDurationMs = 4000,
  onComplete,
  onSettle,
  className,
  actions,
  children,
  paused = false,
  titleLines = 1,
  presentation = 'card',
}: NotificationTileProps) {
  const lockscreen = presentation === 'lockscreen';
  const {
    id,
    variant = 'default',
    severity,
    type,
    icon,
    imageUrl,
    title,
    description,
    createdAt,
    read,
    settled,
  } = notification;

  // Unknown severity strings (backend data can outrun the union) degrade to `variant`.
  const accentVariant = (severity ? variantBySeverity[severity] : undefined) ?? variant;

  // A blocked/broken image (ad-blockers routinely kill external avatars) falls
  // through to the icon/category/dot chain instead of a broken-image glyph.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const image = imageUrl && imageUrl !== failedImageUrl ? imageUrl : undefined;

  // Gate on the Date, not the number: NaN, Infinity AND finite-but-out-of-range
  // epochs (e.g. nanoseconds) all make toISOString() throw.
  const createdAtDate = new Date(createdAt);
  const createdAtIso = Number.isNaN(createdAtDate.getTime()) ? null : createdAtDate.toISOString();

  // Sampled once at mount, not memoised on `createdAt`: `useMemo` is a
  // performance hint React may re-run at any time, and re-running this one
  // would silently restart the live window. A lazy state initialiser is the
  // one place a component is allowed to read the clock.
  const [initialElapsed] = useState(() => Date.now() - createdAt);
  const isLive = !read && !settled && initialElapsed < liveDurationMs;
  const counting = isLive && !paused;

  useEffect(() => {
    if (!counting) return undefined;
    const remaining = Math.max(0, liveDurationMs - initialElapsed);
    const timer = window.setTimeout(() => {
      onSettle?.(id);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [id, counting, initialElapsed, liveDurationMs, onSettle]);

  return (
    <output
      className={cn(
        'relative block w-full shrink-0 overflow-hidden border border-ods-border bg-ods-card',
        lockscreen ? 'rounded-2xl' : 'rounded-md',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex flex-col gap-[var(--spacing-system-xs)] p-[var(--spacing-system-s)]',
          isLive && 'pb-[var(--spacing-system-m)]',
        )}
      >
        {/* Header: icon/image + type label (both severity-colored) + time + dismiss/complete control. */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <span className={cn('flex size-4 shrink-0 items-center justify-center', typeColorByVariant[accentVariant])}>
            {image ? (
              <Image
                src={image}
                alt=""
                onError={() => setFailedImageUrl(image)}
                className="size-4 rounded-[2px] object-cover"
                width={16}
                height={16}
                unoptimized
              />
            ) : (
              (icon ?? <span className={cn('size-1.5 rounded-full', dotColorByVariant[accentVariant])} />)
            )}
          </span>

          {type ? (
            lockscreen ? (
              // A phone names the sender in plain words and never cuts them.
              <p className="min-w-0 flex-1 break-words text-ods-text-secondary text-h6">{type}</p>
            ) : (
              <p className={cn('min-w-0 flex-1 truncate text-h5', typeColorByVariant[accentVariant])} title={type}>
                {type}
              </p>
            )
          ) : (
            <span className="min-w-0 flex-1" />
          )}

          {!isLive && createdAtIso ? (
            <time
              dateTime={createdAtIso}
              className={cn('shrink-0 whitespace-nowrap text-ods-text-secondary text-h6', lockscreen && 'self-start')}
            >
              {formatTicketRelativeTime(createdAtIso)}
            </time>
          ) : null}

          {!lockscreen && (
            <>
              {/* Live X and settled check swap in the same 16px slot; the inactive
              one is removed from the a11y tree and disabled, not just faded. */}
              <span className="relative size-4 shrink-0">
                {[
                  {
                    active: isLive,
                    label: 'Dismiss notification',
                    icon: <XmarkIcon size={16} />,
                    onClick: () => onSettle?.(id),
                  },
                  {
                    active: !isLive,
                    label: 'Mark notification complete',
                    icon: <CheckCircleIcon size={16} />,
                    onClick: () => onComplete(id),
                  },
                ].map(({ active, label, icon: actionIcon, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    aria-label={label}
                    aria-hidden={!active}
                    disabled={!active}
                    tabIndex={active ? 0 : -1}
                    className={cn(headerControlClass, !active && 'pointer-events-none opacity-0')}
                  >
                    {actionIcon}
                  </button>
                ))}
              </span>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col">
          {title ? (
            <p
              className={cn(
                'text-ods-text-primary text-h4',
                titleLines === 2 ? 'line-clamp-2 break-words' : 'truncate',
              )}
              title={typeof title === 'string' ? title : undefined}
            >
              {title}
            </p>
          ) : null}
          {description ? (
            <p
              className="line-clamp-3 text-ods-text-secondary text-h6"
              title={typeof description === 'string' ? description : undefined}
            >
              {description}
            </p>
          ) : null}
        </div>

        {actions}

        {/* Progress sits at the section's bottom edge (above any children). */}
        {counting ? (
          <div
            aria-hidden
            className={cn('absolute inset-x-0 -bottom-px h-1 origin-left', progressColorByVariant[accentVariant])}
            style={{
              animation: `toast-progress ${liveDurationMs}ms linear forwards`,
              animationDelay: `-${initialElapsed}ms`,
            }}
          />
        ) : null}
      </div>

      {children}
    </output>
  );
}
