'use client';

import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { TouchFriendlyTooltip } from '../../ui/touch-friendly-tooltip';
import { getDeviceLifecycleConfig } from './device-status';
import type { DeviceStatusDisplay } from './device-status-display';

/** The design's tooltip box over the lib's own (Figma 5262-161244): the overlay ground, text wrapping at 296px. */
const DEVICE_HINT_CONTENT_CLASS = 'max-w-[296px] bg-ods-menu';

/** A hint trigger's keyboard focus ring, as the connectivity icon's. */
export const DEVICE_HINT_FOCUS_CLASS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus';

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
 * close on it. The PENDING tag's (`DeviceTagHint`) and the outdated agent's (`DeviceOutdatedIcon`) are built on it.
 */
export function DeviceStatusHint({
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
