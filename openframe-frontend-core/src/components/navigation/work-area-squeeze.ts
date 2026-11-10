/**
 * Classes for chrome inside a work-area column that the divider can squeeze below its
 * min width (`AppLayoutWorkArea` `squeezeFloor`). They key on the column's
 * `data-squeezed` through its group (`group/work-area-chat`, `group/work-area-page`), so
 * they work wherever the chrome is rendered from — a portal included — as long as it
 * lands in the column's DOM. No imports: chat and navigation both read it.
 */

/** Gone while squeezed, still read by assistive tech (a column's title). */
export const SQUEEZED_SR_ONLY =
  'group-data-[squeezed]/work-area-chat:sr-only group-data-[squeezed]/work-area-page:sr-only';

/** Gone while squeezed (an avatar, a ⋯ menu, a host's extra cells). */
export const SQUEEZED_HIDDEN =
  'group-data-[squeezed]/work-area-chat:hidden group-data-[squeezed]/work-area-page:hidden';

/**
 * A header cell kept while squeezed (Full screen, Close): the kept cells share the
 * column's width instead of their fixed 56px, so none is cut off at the 108px floor.
 */
export const SQUEEZED_SHARED_CELL =
  'group-data-[squeezed]/work-area-chat:w-auto group-data-[squeezed]/work-area-chat:min-w-0 group-data-[squeezed]/work-area-chat:flex-1 group-data-[squeezed]/work-area-page:w-auto group-data-[squeezed]/work-area-page:min-w-0 group-data-[squeezed]/work-area-page:flex-1';

/**
 * A column header while its chat column is squeezed: the column scrolls sideways, the
 * header sticks to its start and spans what is on screen (`--work-area-visible-width`).
 */
export const SQUEEZED_STICKY_HEADER =
  'group-data-[squeezed]/work-area-chat:sticky group-data-[squeezed]/work-area-chat:left-0 group-data-[squeezed]/work-area-chat:z-10 group-data-[squeezed]/work-area-chat:w-[var(--work-area-visible-width)]';
