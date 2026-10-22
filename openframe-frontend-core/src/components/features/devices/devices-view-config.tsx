'use client';

import { createContext, type ReactNode, useContext } from 'react';
import type { DeviceRow } from './types';

/**
 * What the device views cannot know by themselves, because it belongs to the
 * host: where a device's page lives, where images are served from, and whether
 * the page runs inside the mobile shell. The product provides it once, above
 * every page; without a provider the views render as a picture (no links,
 * image URLs used as given).
 */
export interface DevicesViewConfig {
  /** The device's page. Absent: rows and cards are not links. */
  getDeviceHref?: (device: DeviceRow) => string | undefined;
  /** A customer image's full URL from its stored path and content hash. */
  resolveImageUrl?: (imageUrl: string | null | undefined, hash?: string | null) => string | undefined;
  /** The page runs inside the mobile shell: options nobody can pick there are dropped. */
  isMobileShell?: boolean;
}

const EMPTY_CONFIG: DevicesViewConfig = {};

const DevicesViewConfigContext = createContext<DevicesViewConfig>(EMPTY_CONFIG);

export function DevicesViewConfigProvider({ value, children }: { value: DevicesViewConfig; children: ReactNode }) {
  return <DevicesViewConfigContext.Provider value={value}>{children}</DevicesViewConfigContext.Provider>;
}

export function useDevicesViewConfig(): DevicesViewConfig {
  return useContext(DevicesViewConfigContext);
}

/** A customer image's URL as the host resolves it; the stored value when no host says otherwise. */
export function useDeviceImageUrl(imageUrl: string | null | undefined, hash?: string | null): string | undefined {
  const { resolveImageUrl } = useDevicesViewConfig();
  return resolveImageUrl ? resolveImageUrl(imageUrl, hash) : (imageUrl ?? undefined);
}
