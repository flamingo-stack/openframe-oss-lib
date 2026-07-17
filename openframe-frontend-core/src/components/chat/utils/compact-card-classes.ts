/**
 * Compact-card class constants — single source of truth for the chat-inline
 * `size='sm'` card frame.
 *
 * Lifted from the hub's `components/shared/compact-card/compact-card-classes.ts`
 * so the pure-presentation cards in `entity-cards/` can stop importing from
 * the hub tree. Every compact card across the chat shell shares the SAME
 * outer frame, skeleton frame, image slot, icon slot, text column, and
 * per-line typography.
 *
 * Card-specific variation (Play overlay on podcasts, #N pill on investor
 * updates, status badge on roadmap) lives INSIDE the card next to its
 * other type-specific JSX; the frame stays uniform across types.
 */

/** Loaded compact card outer frame for INTERACTIVE state — anchor wrap
 *  with hover/transition affordance. Use ONLY when the card resolves
 *  to a real, safe href; the user expects a clickable feel. */
export const COMPACT_CARD_OUTER =
  'my-1.5 flex items-start gap-3 w-full p-2 rounded-lg border border-ods-border bg-ods-card no-underline transition-colors hover:border-ods-text-secondary/40'

/** Loaded compact card outer frame for NON-INTERACTIVE state — span wrap
 *  used when `safeHref()` rejects the chat ref's url. */
export const COMPACT_CARD_OUTER_STATIC =
  'my-1.5 flex items-start gap-3 w-full p-2 rounded-lg border border-ods-border bg-ods-card no-underline cursor-default'

/** Skeleton outer frame — same dimensions as loaded, plus `animate-pulse`. */
export const COMPACT_CARD_SKELETON_OUTER =
  'my-1.5 flex w-full animate-pulse items-start gap-3 rounded-lg border border-ods-border bg-ods-card p-2'

/** 56×56 image slot — for cards with a cover image. */
export const COMPACT_CARD_IMAGE_SLOT =
  'relative block shrink-0 self-start w-14 h-14 aspect-square overflow-hidden rounded-md bg-ods-bg'

/** 56×56 placeholder slot for skeletons. */
export const COMPACT_CARD_SKELETON_IMAGE_SLOT =
  'block h-14 w-14 aspect-square shrink-0 self-start rounded-md bg-ods-bg'

/** 56×56 icon slot — for cards without a cover image. */
export const COMPACT_CARD_ICON_SLOT =
  'flex h-14 w-14 aspect-square shrink-0 self-start items-center justify-center rounded-md bg-ods-bg text-ods-accent'

/** Text column wrapper — explicit 56px height with `flex flex-col`. */
export const COMPACT_CARD_TEXT_COL =
  'flex min-w-0 flex-1 flex-col gap-0.5 min-h-14'

/** Title row container — fixed 20px (h-5) to match `text-sm leading-5`. */
export const COMPACT_CARD_TITLE_ROW = 'flex items-center min-w-0 h-5'

/** Subtitle / summary row container — fixed 16px (h-4). */
export const COMPACT_CARD_META_ROW_BOX = 'flex items-center min-w-0 h-4'

/** Title text — bold 14px on a 20px line. */
export const COMPACT_CARD_TITLE =
  'truncate text-sm font-semibold leading-5 text-ods-text-primary'

/** Subtitle text — 11px on a 16px line. */
export const COMPACT_CARD_SUBTITLE =
  'truncate text-h6 text-ods-text-secondary'

/** Summary text — same metrics as subtitle, dropped to 80% opacity. */
export const COMPACT_CARD_SUMMARY =
  'truncate text-h6 text-ods-text-secondary/80'

/** Meta-row variant — multi-part 11px metadata. */
export const COMPACT_CARD_META_ROW =
  'flex items-center gap-1.5 min-w-0 text-h6 text-ods-text-secondary'

/** Non-breaking space — used as a fallback child so the row's height stays 16px. */
export const COMPACT_CARD_ROW_FILLER = ' '

/** Schemes allowed in the outer `<a href>` of a compact card. */
const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:']

/** Return the input url ONLY if it's safe to drop into an `<a href>`:
 *  the scheme must be http / https / mailto, or the URL must be a
 *  same-origin path (`/blog/foo`). Otherwise returns `null`. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null
  // Defense in depth: control chars + zero-width / line-separator chars.
  if (/[\u0000-\u001f\u007f\u200b-\u200d\u2028\u2029\ufeff]/.test(url)) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  // Pure same-origin path.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  if (trimmed.startsWith('#')) return trimmed
  // Reject bare scheme-only inputs.
  if (/^[a-z][a-z0-9+.-]*:$/i.test(trimmed)) return null
  try {
    const parsed = new URL(trimmed, 'https://_safehref_base.invalid')
    if (!SAFE_URL_SCHEMES.includes(parsed.protocol)) return null
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.hostname) return null
    return trimmed
  } catch {
    return null
  }
}
