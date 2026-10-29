'use client';

import type { ProductScreenKey } from './screen-keys';
import { DevicesScreenView } from './screens/devices-view';
import type { ProductScreenComponent } from './types';

/**
 * Each screen's loading state, drawn in its frame while the screen's code (and its fixture) loads: the screen's own
 * VIEW rendered with `loading`, never a separate skeleton. Kept apart from `PRODUCT_SCREEN_LOADERS`: this module
 * imports the screen's view, never the screen module or its fixture, so the lazy chunk stays the screen's. A screen
 * with no entry yet holds its frame's box.
 */
export const PRODUCT_SCREEN_LOADING: Partial<Record<ProductScreenKey, ProductScreenComponent>> = {
  // The Devices screen while its code loads: the same view, in its own loading state.
  devices: ({ compact = false }) => <DevicesScreenView compact={compact} loading />,
};
