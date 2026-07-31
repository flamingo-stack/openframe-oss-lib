/**
 * Hydrated `entity_platforms` junction row — THE shape the hub's
 * attachPlatformsToRows puts on every `<entity>_platforms[]` array
 * (rows arrive featured-first with the platform record's fields spread on
 * via PLATFORM_EMBED). One definition; the per-entity types
 * (case_study_platforms / blog_post_platforms / customer_interview_platforms)
 * all reference it so the shape can never drift per entity.
 */
export interface EntityPlatformAssoc {
  platform_id: string
  is_featured: boolean
  featured_order?: number | null
  /** Platform name — spread from the platform record. Feeds platform-aware
   *  URL composition (composeContentUrlFromPlatforms) without casts. */
  name?: string
  display_name?: string
  /** Alias some admin fetches add (e.g. getCaseStudyForAdmin). */
  platform_name?: string
  id?: string
  created_at?: string
}
