'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * How the device views show a device's status.
 * - `lifecycle` (default): the lifecycle tag (MANAGED, PENDING, ...) and the connectivity icon beside it, with a
 *   Connectivity group in the STATUS funnel (Figma 3324-6819).
 * - `legacy`: the look from before that split, for a host that keeps it behind a flag: one ONLINE / OFFLINE / PENDING
 *   tag, the device type icon, and Online / Offline as options of the STATUS funnel itself. Only the look changes:
 *   online still comes from `connectivity`, and the Online / Offline options still filter on it.
 */
export type DeviceStatusDisplay = 'lifecycle' | 'legacy';

const DeviceStatusDisplayContext = createContext<DeviceStatusDisplay>('lifecycle');

/** Sets the device status display for every device view below it. Without it the views draw `lifecycle`. */
export function DeviceStatusDisplayProvider({
  display,
  children,
}: {
  display: DeviceStatusDisplay;
  children: ReactNode;
}) {
  return <DeviceStatusDisplayContext.Provider value={display}>{children}</DeviceStatusDisplayContext.Provider>;
}

/** The device status display the host set (`DeviceStatusDisplayProvider`), `lifecycle` when none. */
export function useDeviceStatusDisplay(): DeviceStatusDisplay {
  return useContext(DeviceStatusDisplayContext);
}
