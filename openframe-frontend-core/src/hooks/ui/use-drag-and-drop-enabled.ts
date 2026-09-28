'use client';

import { breakpoints, useMediaQuery } from './use-media-query';

/**
 * The one rule for whether drag-and-drop is initialized at all.
 *
 * Pointer type AND breakpoint, never either alone:
 * - A breakpoint alone fails on tablets: an iPad in landscape is 1024-1366px
 *   wide and would pass any sane `min-width` — exactly the case being excluded,
 *   because the HTML5 drag-and-drop API Pragmatic builds on does not fire under
 *   touch.
 * - `pointer: coarse` alone fails the other way: a touchscreen laptop with a
 *   trackpad reports `pointer: fine` and should keep DnD, but in a narrow
 *   window its lists collapse to the mobile layout where a drag handle is out
 *   of place.
 * - No `'ontouchstart' in window`, no UA sniffing: the first is true on touch
 *   laptops, the second is neither accurate nor reactive. A media query
 *   re-evaluates live when a mouse is attached or the window resizes.
 *
 * `breakpoints.md` (800px) is the existing tablet step — no new breakpoint.
 */
export const DRAG_AND_DROP_MEDIA_QUERY = `(pointer: fine) and (hover: hover) and ${breakpoints.md}`;

/**
 * Whether drag-and-drop should be available on this device/viewport.
 *
 * `false` on touch/narrow screens — there the reordering surfaces render
 * explicit controls (`SortableMoveButtons`) instead of a drag handle, and no
 * DnD is initialized at all. Also `false` during SSR and the first client
 * render (`useMediaQuery` is still `undefined`): defaulting to "off" renders
 * no dead drag handle, and the underlying layout effect settles the real
 * answer before first paint, so a desktop user never sees the fallback flash.
 */
export function useDragAndDropEnabled(): boolean {
  return useMediaQuery(DRAG_AND_DROP_MEDIA_QUERY) ?? false;
}
