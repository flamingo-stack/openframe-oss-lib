'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { DEVICE_HINT_FOCUS_CLASS, DeviceStatusHint } from './device-status-hint';

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
