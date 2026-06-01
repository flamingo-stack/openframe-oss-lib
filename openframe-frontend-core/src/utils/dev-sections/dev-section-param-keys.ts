/**
 * Canonical URL param keys for the dev-center sections — the ONE source for both:
 *   - the chrome registry (`OPENFRAME_DEV_SECTIONS`), which WRITES `?<key>=…` to the URL, and
 *   - the list views (`RoadmapView` / `ProductReleasesView` / `DeliveryLists`), which READ
 *     `?<key>=…` to fetch the filtered list.
 *
 * The chrome and the view MUST agree on the key or filtering silently breaks. Importing
 * from here (instead of re-declaring the literal in each place) makes that impossible to
 * get wrong. Pure string constants — no React, no heavy deps — so both server-bundled
 * utils and client views can import it freely.
 */
export const DEV_SECTION_PARAM_KEYS = {
  /** Free-text search box — shared by every dev-center section. */
  search: 'search',
  /** Roadmap (and Help Center tickets) status filter. */
  status: 'status',
  /** Product-releases stability-tier filter. */
  releaseStatus: 'release_status',
  /** Delivery (bug-fix / enhancement) task-type filter. */
  deliveryTaskType: 'task_type',
} as const
