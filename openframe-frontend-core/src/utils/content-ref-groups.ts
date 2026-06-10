/**
 * Content Ref Group Configuration
 *
 * Single source of truth for grouping content_refs by type. Used by both:
 *  - components/related-content (detail page rail — lives in this lib)
 *  - the hub's lib/utils/investor-email-utils.ts (email builder, via the
 *    hub's re-export shim at lib/config/content-ref-groups.ts)
 *
 * Lives in utils/ (server-safe tsup block) so hub server-side code can
 * import it.
 *
 * Each entry carries the metadata RelatedContentSection needs to render the
 * group WITHOUT re-implementing per-type logic locally:
 *   - `label`: section heading.
 *   - `order`: source-stable ordering (lowest first).
 *   - `layout`: 'list' (one-per-row, full-width cards) or 'grid' (responsive
 *     column grid).
 *   - `gridSize`: card-size variant passed to the per-type card dispatch.
 *     `'lg'` matches the canonical large-card variant openframe + flamingo
 *     apps already use; `'default'` is the legacy denser variant. New types
 *     should pick `'lg'` whenever the card has a large variant.
 *
 * Adding a new content type = one entry here. RelatedContentSection picks up
 * the new group automatically (no hardcoded set to update). NOTE: the hub's
 * related-content SUGGESTION candidate list is DERIVED from these keys (minus
 * an explicit exclusion knob) — a new entry here becomes a suggestion
 * candidate iff it also resolves through the hub's TYPE_TO_ENTITY → RAG
 * config chain (unresolvable entries are dropped loudly at module load).
 */

export type ContentRefLayout = 'list' | 'grid'

/** Subset of `EntityCardSize` (entity-card dispatch) appropriate for
 *  grid/list rendering in RelatedContentSection. Duplicated as a literal
 *  union here to avoid a config→component import cycle. Kept in lockstep
 *  with `EntityCardSize`; widen here when a new size is added there. */
export type ContentRefGridSize = 'lg' | 'default' | 'sm'

export interface ContentRefGroupConfig {
  label: string
  order: number
  layout: ContentRefLayout
  gridSize: ContentRefGridSize
}

export const CONTENT_REF_GROUPS: Record<string, ContentRefGroupConfig> = {
  investor_update:     { label: 'Investor Updates',    order: 1, layout: 'grid', gridSize: 'default' },
  product_release:     { label: 'Product Releases',    order: 2, layout: 'list', gridSize: 'lg' },
  podcast:             { label: 'Podcasts',            order: 3, layout: 'list', gridSize: 'default' },
  webinar:             { label: 'Webinars',            order: 4, layout: 'list', gridSize: 'default' },
  case_study:          { label: 'Case Studies',        order: 5, layout: 'grid', gridSize: 'default' },
  event:               { label: 'Events',              order: 6, layout: 'list', gridSize: 'default' },
  blog_post_existing:  { label: 'Blog Posts',          order: 7, layout: 'grid', gridSize: 'default' },
  customer_interview:  { label: 'Customer Interviews', order: 8, layout: 'grid', gridSize: 'default' },
  onboarding_guide:    { label: 'Onboarding Guides',   order: 9, layout: 'list', gridSize: 'default' },
}

/** Human-readable label for a content_ref `type`. Returns null when the type
 *  isn't registered — caller decides the fallback. Use `getContentRefLabelOrTitleCase`
 *  to get a consistent title-cased fallback across all surfaces. */
export function getContentRefLabel(type: string): string | null {
  return CONTENT_REF_GROUPS[type]?.label ?? null
}

/** Resolved label with a single shared fallback shape — title-cased version
 *  of the raw type string for any unregistered type. Both RelatedContentSection
 *  AND the investor-email builder consume this so cross-surface label rendering
 *  for unregistered types is identical (no drift between "podcast guest" and
 *  "Podcast Guest"). */
export function getContentRefLabelOrTitleCase(type: string): string {
  return (
    CONTENT_REF_GROUPS[type]?.label ??
    type.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
  )
}

/** Sort a set of present content_ref types into the canonical group order
 *  (registered types first in CONTENT_REF_GROUPS `order`, then unregistered
 *  types appended in insertion order). Used by RelatedContentSection AND the
 *  investor-email builder so cross-surface ordering stays identical. */
export function orderContentRefTypes(present: Iterable<string>): string[] {
  const presentSet = new Set(present)
  const registeredInOrder = Object.entries(CONTENT_REF_GROUPS)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type]) => type)
    .filter((type) => presentSet.has(type))
  const unregistered = [...presentSet].filter((type) => !CONTENT_REF_GROUPS[type])
  return [...registeredInOrder, ...unregistered]
}
