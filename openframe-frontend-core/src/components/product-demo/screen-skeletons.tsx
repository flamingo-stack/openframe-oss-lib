'use client';

import type { ProductScreenKey } from './screen-keys';
import { DevicesScreenView } from './screens/devices-view';
import type { ProductScreenComponent } from './types';

/** The Devices screen while its code loads: the same panel in its own loading state. */
function DevicesScreenSkeleton({ compact = false }: { compact?: boolean }) {
  return <DevicesScreenView compact={compact} loading />;
}

/**
 * Each screen's own skeleton, drawn in its frame while the screen's code (and its fixture) loads. Kept apart from
 * `PRODUCT_SCREEN_LOADERS`: this module imports the screen's VIEW, never the screen module or its fixture, so the
 * lazy chunk stays the screen's. A screen with no entry yet holds its frame's box.
 */
export const PRODUCT_SCREEN_SKELETONS: Partial<Record<ProductScreenKey, ProductScreenComponent>> = {
  devices: DevicesScreenSkeleton,
};
