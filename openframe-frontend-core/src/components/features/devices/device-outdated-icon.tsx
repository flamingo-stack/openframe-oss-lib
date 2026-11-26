'use client';

import { cn } from '../../../utils/cn';
import { AlertTriangleIcon } from '../../icons-v2-generated';
import { DEVICE_HINT_FOCUS_CLASS, DeviceStatusHint } from './device-status-hint';
import { showsOutdatedAgentMark } from './device-statuses';

/** The outdated-agent icon's tooltip and accessible name (Figma 5262-161244). */
export const DEVICE_OUTDATED_HINT = 'Outdated agent. Reinstall it to keep this device connected.';

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
 * accessible name. Drawn only where `showsOutdatedAgentMark` says so: the server flags the client, and the device is
 * not an archive or about to become one (reinstalling there would bring the device back). A click or tap on it never
 * opens the row or the card it sits in.
 */
export function DeviceOutdatedIcon({ clientOutdated, status, className }: DeviceOutdatedIconProps) {
  if (!showsOutdatedAgentMark(clientOutdated, status)) return null;
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
