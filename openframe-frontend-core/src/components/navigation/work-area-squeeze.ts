/**
 * Classes for chrome inside a work-area column that the divider can squeeze below its
 * min width (`AppLayoutWorkArea` `squeezeFloor`). They key on the column's
 * `data-squeezed` through its group (`group/work-area-chat`, `group/work-area-page`), so
 * they work wherever the chrome is rendered from — a portal included — as long as it
 * lands in the column's DOM. No imports: chat and navigation both read it.
 */

/**
 * A button cell of a work-area column header (the chat's `MingoChatHeader look="column"`, the
 * page's `AppColumnHeader`): 56px square, the default border before it, a 20px primary glyph.
 * One string, so both columns draw their Full screen and Close alike.
 */
export const COLUMN_HEADER_CELL = 'w-14 border-l border-ods-border text-ods-text-primary [&_svg]:h-5 [&_svg]:w-5';

/** Gone while squeezed (an avatar, a ⋯ menu, a host's extra cells). */
export const SQUEEZED_HIDDEN =
  'group-data-[squeezed]/work-area-chat:hidden group-data-[squeezed]/work-area-page:hidden';

/**
 * A header cell kept while squeezed (Full screen, Close): its square 56px as long as the
 * header has room (the title truncating first), narrower only once it has none, so two
 * cells still fit the 108px floor.
 */
export const SQUEEZED_KEPT_CELL =
  'group-data-[squeezed]/work-area-chat:min-w-0 group-data-[squeezed]/work-area-chat:shrink group-data-[squeezed]/work-area-chat:px-0 group-data-[squeezed]/work-area-page:min-w-0 group-data-[squeezed]/work-area-page:shrink group-data-[squeezed]/work-area-page:px-0';

/**
 * A column header while its chat column is squeezed: the column scrolls sideways, the
 * header sticks to its start and spans what is on screen (`--work-area-visible-width`).
 */
export const SQUEEZED_STICKY_HEADER =
  'group-data-[squeezed]/work-area-chat:sticky group-data-[squeezed]/work-area-chat:left-0 group-data-[squeezed]/work-area-chat:z-10 group-data-[squeezed]/work-area-chat:w-[var(--work-area-visible-width)]';
