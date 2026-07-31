/**
 * Single source of truth for the `seo_description` length budget.
 *
 * Unlike `seo_title` (soft search-engine guidance), this is a HARD cap: the
 * `seo_description` DB columns are `varchar(160)` and Postgres rejects longer
 * values outright ("value too long for type character varying(160)").
 *
 * This number lives in exactly ONE place. Consumers:
 *   - `SEOEditorPreview` — input `maxLength` + the too-long alert.
 *   - the hub — imports it (via `@flamingo-stack/openframe-frontend-core/utils`)
 *     for the AI generation prompt guidance and the rewrite-to-fit helper.
 */
export const SEO_DESCRIPTION_MAX_LENGTH = 160;
