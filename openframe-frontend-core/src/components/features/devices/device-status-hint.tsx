'use client';

import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { AlertTriangleIcon } from '../../icons-v2-generated';
import { TouchFriendlyTooltip } from '../../ui/touch-friendly-tooltip';
import { getDeviceLifecycleConfig } from './device-status';
import type { DeviceStatusDisplay } from './device-status-display';
import { isArchiveLifecycleStatus } from './device-statuses';

/** The design's tooltip box over the lib's own (Figma 5262-161244): the overlay ground, text wrapping at 296px. */
const DEVICE_HINT_CONTENT_CLASS = 'max-w-[296px] bg-ods-menu';

/** A hint trigger's keyboard focus ring, as the connectivity icon's. */
const DEVICE_HINT_FOCUS_CLASS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus';

/** The outdated-agent icon's tooltip and accessible name (Figma 5262-161244). */
export const DEVICE_OUTDATED_HINT = 'Outdated agent. Reinstall it to keep this device connected.';

/** The PENDING tag's tooltip, two lines (Figma 5262-162002). */
const DEVICE_PENDING_HINT_LINES = [
  'Not managed yet: OpenFrame is still connecting this device.',
  'It turns Managed when setup finishes.',
] as const;

/** A click on a hint (its trigger, or its open tooltip) is the hint's own. */
function keepClickInHint(event: MouseEvent) {
  event.stopPropagation();
}

/**
 * A device status hint: a tooltip that opens on hover, keyboard focus and tap (`TouchFriendlyTooltip`; Radix alone
 * never opens on a tap), in the design's box. Its clicks never reach the row or the card it sits in: the wrapper is
 * `data-no-row-click` (a table row neither follows its link nor runs its click) and stops the click, so a card's own
 * `onClick` (`DeviceCard`) never sees it either, whether it lands on the trigger or on the portalled tooltip (whose
 * click bubbles through React's tree, past this wrapper). Pointer-down is left to bubble, so other open popovers still
 * close on it.
 */
function DeviceStatusHint({
  content,
  side,
  shrink = false,
  children,
}: {
  content: ReactNode;
  side: 'top' | 'bottom';
  /** The wrapper may shrink below its content (a tag that cuts its own label); otherwise it never does. */
  shrink?: boolean;
  children: ReactElement;
}) {
  return (
    <span
      data-no-row-click
      className={shrink ? 'inline-flex min-w-0 max-w-full' : 'inline-flex shrink-0'}
      onClick={keepClickInHint}
    >
      <TouchFriendlyTooltip content={content} side={side} contentClassName={DEVICE_HINT_CONTENT_CLASS}>
        {children}
      </TouchFriendlyTooltip>
    </span>
  );
}

/**
 * A status tag with its hint under it (the PENDING tag's, Figma 5262-161893). The tag is wrapped in a focusable box,
 * so a keyboard opens the hint as hover and a tap do. `shrink`: the boxes may narrow with a tag that cuts its own label
 * (a narrow name cell); by default they never shrink, so a tag that does not cut itself is never overdrawn.
 */
export function DeviceTagHint({
  hint,
  shrink = false,
  children,
}: {
  hint: ReactNode;
  shrink?: boolean;
  children: ReactNode;
}) {
  return (
    <DeviceStatusHint content={hint} side="bottom" shrink={shrink}>
      <span
        tabIndex={0}
        data-device-tag-hint
        className={cn('inline-flex rounded-md', shrink ? 'min-w-0 max-w-full' : 'shrink-0', DEVICE_HINT_FOCUS_CLASS)}
      >
        {children}
      </span>
    </DeviceStatusHint>
  );
}

/**
 * The hint of a lifecycle tag: the PENDING one's in the lifecycle display (every status `getDeviceLifecycleConfig`
 * reads as PENDING), none for any other tag or in the legacy display.
 */
export function devicePendingHint(status: string | null | undefined, display: DeviceStatusDisplay): ReactNode {
  if (display !== 'lifecycle' || getDeviceLifecycleConfig(status).label !== 'PENDING') return null;
  const [first, second] = DEVICE_PENDING_HINT_LINES;
  return (
    <>
      {first}
      <br />
      {second}
    </>
  );
}

export interface DeviceOutdatedIconProps {
  /** The server's verdict that the device's client is outdated (`DeviceRow.clientOutdated`). Only `true` draws it. */
  clientOutdated: boolean | null | undefined;
  /** The device's lifecycle status. An archive one (`isArchiveLifecycleStatus`) draws nothing: nothing to reinstall. */
  status: string | null | undefined;
  className?: string;
}

/**
 * The outdated-agent mark (Figma 5262-160005, `outdated-icon`): an orange warning triangle after the device's name or
 * status, whose tooltip, on hover, keyboard focus or tap, says to reinstall the agent; the same words are its
 * accessible name. Nothing unless the server flags the client, and nothing on a device that is an archive or about to
 * become one (pending deletion, deleted, archived, decommissioned): reinstalling there would bring the device back.
 * A click or tap on it never opens the row or the card it sits in.
 */
export function DeviceOutdatedIcon({ clientOutdated, status, className }: DeviceOutdatedIconProps) {
  if (clientOutdated !== true || isArchiveLifecycleStatus(status)) return null;
  return (
    <DeviceStatusHint content={DEVICE_OUTDATED_HINT} side="top">
      <span
        role="img"
        // Focusable, so a keyboard opens the tooltip as hover does.
        tabIndex={0}
        aria-label={DEVICE_OUTDATED_HINT}
        data-device-outdated
        className={cn('inline-flex shrink-0 rounded-sm text-ods-warning', DEVICE_HINT_FOCUS_CLASS, className)}
      >
        <AlertTriangleIcon size={16} aria-hidden />
      </span>
    </DeviceStatusHint>
  );
}
