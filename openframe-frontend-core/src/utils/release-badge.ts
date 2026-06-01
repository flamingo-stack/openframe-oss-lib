/**
 * Single source of truth for mapping a product release's `release_type` to
 * the `StatusBadge` colorScheme used in the `ProductReleaseCard` lg variant's
 * metadata-grid Type cell. Every surface that renders a
 * `<ProductReleaseCard size="lg" ...>` must pass this value as
 * `releaseTypeBadgeColor` or the card falls back to a `'—'` placeholder
 * (the card requires BOTH `releaseType && releaseTypeBadgeColor` to paint a
 * colored badge).
 *
 * Mapping mirrors the visual hierarchy operators expect at a glance:
 *   major  → error   (red, breaking change)
 *   minor  → cyan    (accent, feature)
 *   patch  → success (green, safe bump)
 *   beta/alpha → warning (yellow, preview)
 *
 * (Lifted from the hub so every embedder — not just the hub — gets the rich
 * card metadata. The admin form's `releaseTypeOptions.color` array uses a
 * different color vocabulary — different concern; don't unify here.)
 */
export type ReleaseType = 'major' | 'minor' | 'patch' | 'beta' | 'alpha'
export type ReleaseTypeBadgeColor = 'error' | 'cyan' | 'success' | 'warning'

/**
 * Accepts a wider input type than `ReleaseType` because list-API rows can
 * carry legacy / unenforced `release_type` values. Returns `undefined` for
 * unknown values — the card guards on `releaseType && releaseTypeBadgeColor`
 * to decide whether to render a colored badge or fall back to an em-dash, so
 * an undefined return is the correct failure mode (badge hidden), not a crash.
 */
export function releaseTypeToBadgeColor(
  t: ReleaseType | string | null | undefined,
): ReleaseTypeBadgeColor | undefined {
  switch (t) {
    case 'major':
      return 'error'
    case 'minor':
      return 'cyan'
    case 'patch':
      return 'success'
    case 'beta':
    case 'alpha':
      return 'warning'
    default:
      return undefined
  }
}
