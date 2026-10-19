/**
 * THE sizes of the library's components, the one place each is written. A component and its loading skeleton read
 * the same entry, so the two are one size at every width; a per-file copy of a size (or a height computed by hand in
 * pixels) is what drifted before. Layout (frames, gaps, borders, radii) stays beside its component; only SIZES live
 * here.
 *
 * Every value is a static Tailwind class string (Tailwind finds classes by scanning source, so a class is never built
 * from parts). Import-free, so a server module or a config can read it too.
 */

/**
 * A box that keeps N lines of its OWN text class whatever its content's length: `lh` is the element's computed line
 * height, so the minimum follows the class at every breakpoint. Put the text class (`text-h3`, `text-h6`…) on the SAME
 * element, never a pixel height worked out from today's line height.
 */
export const TEXT_LINES_MIN = {
  1: 'min-h-[1lh]',
  2: 'min-h-[2lh]',
  3: 'min-h-[3lh]',
} as const;

/** A box exactly N lines of its own text class tall (a text skeleton's lines). Past 6, set the height inline in `lh`. */
export const TEXT_LINES_HEIGHT = {
  1: 'h-[1lh]',
  2: 'h-[2lh]',
  3: 'h-[3lh]',
  4: 'h-[4lh]',
  5: 'h-[5lh]',
  6: 'h-[6lh]',
} as const;

/** A cover or media box's shape. `og`: the 1200×630 link-preview card every content cover is cut to. */
export const MEDIA_ASPECT = {
  og: 'aspect-[1200/630]',
  video: 'aspect-video',
  square: 'aspect-square',
  photo: 'aspect-[3/2]',
} as const;

/**
 * An avatar's box (a person's photo or an organisation's logo): ONE scale, read by `SquareAvatar`, by every avatar
 * drawn by hand and by every skeleton that stands in for one. `byline` and `profile` are the article byline's and the
 * profile header's.
 */
export const AVATAR_SIZE = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  byline: 'h-14 w-14',
  xl: 'h-16 w-16',
  profile: 'h-24 w-24',
} as const;

/** The same scale in pixels, for an image's intrinsic `width`/`height` attributes (layout comes from the class). */
export const AVATAR_SIZE_PX = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  byline: 56,
  xl: 64,
  profile: 96,
} as const satisfies Record<keyof typeof AVATAR_SIZE, number>;

export type AvatarSize = keyof typeof AVATAR_SIZE;

/** A glyph drawn in a line of text or a control (an icon, a mark, a check). `step`: one step up from `md`. */
export const ICON_SIZE = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
  step: 'size-5 md:size-6',
} as const;

/** A dot (a status light, a live indicator). */
export const DOT_SIZE = {
  sm: 'size-2',
  md: 'size-3',
} as const;

/**
 * A square tile that holds an icon, a logo, a QR code or a thumbnail. `entity`: an entity's logo beside its name;
 * `touch`: a tap target (44px on a phone, 48px from `md`); `qr`: a scannable code.
 */
export const TILE_SIZE = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-10',
  xl: 'size-12',
  thumb: 'size-14',
  feature: 'size-16',
  entity: 'size-[52px] content-md:size-[60px]',
  touch: 'size-11 md:size-12',
  qr: 'size-36',
} as const;

/** A form control's own box. */
export const CONTROL_SIZE = {
  checkbox: 'size-4',
  selection: 'size-6',
  /** A textarea's least height: four rows of its `text-h4` (one row of it is the vertical padding). */
  textarea: 'min-h-[96px]',
} as const;
