/**
 * THE sizes every picture is fetched at: the one table, read by every component that draws a picture, by the host's
 * image settings (a Next host's `images.deviceSizes`, `images.imageSizes` and `images.qualities` are derived from it,
 * never typed) and by the code that makes pictures on the server (link-preview cards, emails, video posters).
 *
 * Why one table: a resized picture is cached by its exact address, so every width, quality and fit a component picks
 * on its own is another copy the image host makes and caches separately. With eight widths per picture, three
 * qualities and ad-hoc pixel sizes, a blog post's cover almost never had a cached copy when a reader arrived, and
 * waited for a fresh resize (measured 2026-10-26: 19 of 20 blog covers, ~0.6 s each; Google's field data showed the
 * cover's download time going from 0.47 s to 1.18 s). A short ladder of widths and one quality keep the copies few, so
 * the ones that exist are reused.
 *
 * What a component chooses is the SLOT (how wide the picture is drawn), never a width or a quality: a responsive
 * picture states `sizes={IMAGE_SLOT.card}`, a fixed-size one states its box from `IMAGE_FIXED_PX` (or the avatar
 * scale). The browser then picks a width from the ladder. Import-free, so a host's config can read it.
 */

/**
 * The widths a responsive picture is offered at (a `srcset`): every responsive picture, of every kind, picks from
 * this ladder. Covers a phone (828, and 1200 at 3x), a desktop column (1200) and a retina desktop (1920).
 */
export const IMAGE_WIDTHS = [640, 828, 1200, 1920] as const;

/**
 * The widths a fixed-size picture (an avatar, a logo, a thumbnail) is fetched at: its 1x and 2x, rounded up to this
 * ladder. Any box up to 192 px lands on one of these four files.
 */
export const IMAGE_FIXED_WIDTHS = [32, 64, 128, 256, 384] as const;

/** The quality every resized picture is encoded at. One value: a second quality is a second copy of every picture. */
export const IMAGE_QUALITY = 75;

/** The widest a picture is ever stored or fetched: the top of {@link IMAGE_WIDTHS}. Uploads are capped to it. */
export const IMAGE_MAX_WIDTH = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];

/**
 * How wide a responsive picture is drawn, relative to the window: its `sizes`. One entry per kind of slot; a new
 * layout picks the closest slot (a few pixels' difference picks the same file from the ladder anyway).
 */
export const IMAGE_SLOT = {
  /** The whole window (a background, a lightbox). */
  full: '100vw',
  /** An article's or a page's main picture, up to its 1200 px column. */
  hero: '(max-width: 1200px) 100vw, 1200px',
  /** Half the page from a laptop up, the whole width below (a split hero, a program cover). */
  half: '(min-width: 1024px) 50vw, 100vw',
  /** A card in a two- or three-column grid. */
  card: '(max-width: 768px) 100vw, (max-width: 1519px) 50vw, 33vw',
  /** A card in a three- or four-column grid. */
  cardSmall: '(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw',
  /** A column of a photo wall: a quarter of the page, half on a phone. */
  wall: '(min-width: 1024px) 25vw, 50vw',
  /** A fixed column up to 400 px (a side panel, a preview). */
  panel: '(max-width: 768px) 100vw, 400px',
  /** A picture in running text, up to 400 px (a markdown image), the whole width only on the narrowest phones. */
  inline: '(max-width: 400px) 100vw, 400px',
  /** A cover beside text, up to 256 px (a release card's cover), the whole width on a phone. */
  aside: '(max-width: 768px) 100vw, 256px',
  /** A wide column up to 768 px (a modal's media, a reading column). */
  column: '(max-width: 768px) 100vw, 768px',
} as const;

export type ImageSlot = keyof typeof IMAGE_SLOT;

/**
 * The boxes a fixed-size picture is drawn in, in CSS pixels: its `width`/`height` attributes. Avatars use the avatar
 * scale (`AVATAR_SIZE_PX`); everything else fixed (a logo, a thumbnail, a tile's picture) uses one of these.
 */
export const IMAGE_FIXED_PX = {
  icon: 16,
  glyph: 20,
  logo: 32,
  logoLg: 40,
  logoXl: 48,
  tile: 56,
  thumb: 64,
  mark: 96,
  feature: 128,
  preview: 192,
  cover: 240,
} as const;

export type ImageFixedSize = keyof typeof IMAGE_FIXED_PX;

/** The `sizes` of a `fill` picture drawn in a fixed box (`"56px"`), from {@link IMAGE_FIXED_PX}. */
export function fixedImageSlot(size: ImageFixedSize): `${number}px` {
  return `${IMAGE_FIXED_PX[size]}px`;
}

/**
 * Pictures made on the server, at one size each (they are files, not a `srcset`): the link-preview card, an email's
 * pictures, a video's poster.
 */
export const IMAGE_FRAME = {
  /** The 1200×630 card every link preview (Open Graph, X, Slack, LinkedIn) is drawn at. */
  social: { width: 1200, height: 630 },
  /** An email's lead picture, at 2x its 560 px column. */
  emailHero: { width: 1120, height: 630 },
  /** An email's card picture, at 2x its 120 px box. */
  emailCard: { width: 240, height: 160 },
  /** A video's poster when the caller states no size. */
  poster: { width: 560, height: 315 },
} as const;

export type ImageFrame = keyof typeof IMAGE_FRAME;

/**
 * The ladder width to fetch for a picture drawn `drawnPx` wide (already multiplied for the screen's density): the
 * smallest width of {@link IMAGE_WIDTHS} that covers it, else the widest. For code that measures a slot itself (a
 * photo wall's column) and asks for one URL, so it lands on a file the `srcset` pictures share.
 */
export function imageWidthFor(drawnPx: number): number {
  for (const width of IMAGE_WIDTHS) if (width >= drawnPx) return width;
  return IMAGE_MAX_WIDTH;
}
