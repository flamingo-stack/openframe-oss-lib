'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from '../../../embed-shims/next-image';
import { ICON_SIZE } from '../../../styles/component-sizes';
import { cn } from '../../../utils/cn';
import { formatTicketRelativeTime } from '../../../utils/date-utils';
import { CheckCircleIcon } from '../../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { XmarkIcon } from '../../icons-v2-generated/signs-and-symbols/xmark-icon';
import { InteractiveSkeleton, TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../../ui/button';
import { useLoadingScope } from '../../ui/loading-scope';
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

/** The trailing control sits centred over its 16px slot. */
const headerControlClass = 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2';

/** The header's icon box and its trailing control's box, read by the tile and by its skeleton. */
const TILE_ICON_BOX_CLASS = `flex ${ICON_SIZE.sm} shrink-0 items-center justify-center`;
const TILE_CONTROL_BOX_CLASS = `relative ${ICON_SIZE.sm} shrink-0`;

interface NotificationTileOptions {
  liveDurationMs?: number;
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
  /**
   * Words shown in place of the relative time ("now"). For a mock that stays
   * on screen: its notifications have just arrived for as long as it plays.
   */
  timeLabel?: string;
  /** The loading form's description lines (default two). */
  descriptionLines?: number;
}

/**
 * The notification and what dismisses it, or `loading` while the host reads it: the tile then draws its own loading
 * form, as it does in a loading scope (an approval tile, one given `actions`, draws its button row too).
 */
export type NotificationTileProps = NotificationTileOptions &
  (
    | { notification: Notification; onComplete: (id: string) => void; loading?: boolean }
    | {
        loading: true;
        notification?: undefined;
        onComplete?: undefined;
        /** `approval`: the loading form draws the approval button row. Default: `approval` when `actions` is given. */
        variant?: 'default' | 'approval';
      }
  );

type LoadedNotificationTileProps = NotificationTileOptions & {
  notification: Notification;
  onComplete: (id: string) => void;
};

/** A notification as a tile; ONE switch: in a loading scope (or `loading`) its own loading form. */
export function NotificationTile(props: NotificationTileProps) {
  if (useLoadingScope() || props.loading) {
    const variant = ('variant' in props && props.variant) || (props.actions ? 'approval' : 'default');
    return (
      <NotificationTileSkeleton
        variant={variant}
        presentation={props.presentation}
        descriptionLines={props.descriptionLines}
        className={props.className}
      />
    );
  }
  return <LoadedNotificationTile {...props} />;
}

function LoadedNotificationTile({
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
  timeLabel,
}: LoadedNotificationTileProps) {
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
          <span className={cn(TILE_ICON_BOX_CLASS, typeColorByVariant[accentVariant])}>
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
              {timeLabel ?? formatTicketRelativeTime(createdAtIso)}
            </time>
          ) : null}

          {!lockscreen && (
            <>
              {/* Live X and settled check swap in the same 16px slot; the inactive
              one is removed from the a11y tree and disabled, not just faded. */}
              <span className={TILE_CONTROL_BOX_CLASS}>
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
                  <Button
                    variant="transparent"
                    size="icon-inline"
                    key={label}
                    type="button"
                    onClick={onClick}
                    aria-label={label}
                    aria-hidden={!active}
                    disabled={!active}
                    tabIndex={active ? 0 : -1}
                    className={cn(headerControlClass, !active && 'invisible')}
                  >
                    {actionIcon}
                  </Button>
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

/**
 * The two buttons on a lock-screen approval tile: compact and their own width. Stretched to fill the tile they
 * dwarfed the notification wherever the tile is wide (a phone-width page shows it at the full content width). Shared
 * by the approval tile and its skeleton.
 */
export const LOCKSCREEN_APPROVAL_BUTTON_CLASS = 'h-9 min-w-24';

/**
 * The Approve and Reject buttons on a card approval tile: one fixed width that holds either label at every
 * breakpoint, so the tile's skeleton draws the buttons at their loaded width. Shared by the tile and its skeleton.
 */
export const APPROVAL_BUTTON_CLASS = 'w-20';

/** The card approval tile's trailing toggle (the command section's chevron). Shared by the tile and its skeleton. */
export const APPROVAL_TOGGLE_BUTTON_CLASS = 'ml-auto w-6 shrink-0 px-0 md:w-8';

interface NotificationTileSkeletonProps {
  /** `approval`: the approval tile, which adds a row of small buttons under the body. */
  variant?: 'default' | 'approval';
  /** The tile's `presentation`: a lock screen has no trailing control and its approval buttons are compact. */
  presentation?: 'card' | 'lockscreen';
  /** The lines the description takes (2 by default: a host that rotates tiles in one cell is as tall as its tallest tile). */
  descriptionLines?: number;
  className?: string;
}

/** The header's icon and trailing control: the box each sits in, with a bar filling it. */
function TileSquare({ box, bar }: { box: string; bar: string }) {
  return (
    <span className={box}>
      <UnifiedSkeleton as="span" width="1rem" className={cn('h-4', bar)} />
    </span>
  );
}

/**
 * A tile while its notification is read, box for box: the tile's frame and pad, the header (icon, type, time, and on
 * a card the trailing control), a one-line title over the description's lines, and for `approval` the button row.
 * Each text row is its text's own line box (`TextLineSkeleton` at the tile's type steps), so the skeleton is the
 * loaded tile's height at every breakpoint.
 */
function NotificationTileSkeleton({
  variant = 'default',
  presentation = 'card',
  descriptionLines = 2,
  className,
}: NotificationTileSkeletonProps) {
  const lockscreen = presentation === 'lockscreen';
  return (
    <output
      aria-hidden
      className={cn(
        'relative block w-full shrink-0 overflow-hidden rounded-md border border-ods-border bg-ods-card',
        className,
      )}
    >
      <span className="relative flex flex-col gap-[var(--spacing-system-xs)] p-[var(--spacing-system-s)]">
        <span className="flex items-center gap-[var(--spacing-system-xs)]">
          <TileSquare box={TILE_ICON_BOX_CLASS} bar="rounded-[2px]" />
          <TextLineSkeleton as="span" type={lockscreen ? 'h6' : 'h5'} className="w-28" />
          <span className="min-w-0 flex-1" />
          <TextLineSkeleton as="span" type="h6" className={cn('w-14', lockscreen && 'self-start')} />
          {!lockscreen && <TileSquare box={TILE_CONTROL_BOX_CLASS} bar="rounded-full" />}
        </span>
        <span className="grid min-w-0 grid-cols-1">
          <TextLineSkeleton as="span" type="h4" className="w-3/5" />
          <TextLineSkeleton as="span" type="h6" lines={descriptionLines} />
        </span>
        {variant === 'approval' && (
          <span className="flex w-full items-center gap-[var(--spacing-system-xs)]">
            <InteractiveSkeleton.Button
              size="small"
              className={lockscreen ? LOCKSCREEN_APPROVAL_BUTTON_CLASS : APPROVAL_BUTTON_CLASS}
            />
            <InteractiveSkeleton.Button
              size="small"
              className={lockscreen ? LOCKSCREEN_APPROVAL_BUTTON_CLASS : APPROVAL_BUTTON_CLASS}
            />
            {!lockscreen && <InteractiveSkeleton.Button size="small" className={APPROVAL_TOGGLE_BUTTON_CLASS} />}
          </span>
        )}
      </span>
    </output>
  );
}
