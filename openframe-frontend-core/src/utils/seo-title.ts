/**
 * Single source of truth for the `seo_title` length budget.
 *
 * The `seo_title` is rendered as the page `<title>` VERBATIM — no brand suffix is
 * appended to it (the `| <Brand>` suffix is kept only on the default/actual-title
 * fallback). So this is the full rendered-title budget; search engines truncate
 * page titles around 60 chars.
 *
 * This number lives in exactly ONE place. Consumers:
 *   - `SEOEditorPreview` — input `maxLength` + the too-long alert.
 *   - the hub — imports it (via `@flamingo-stack/openframe-frontend-core/utils`)
 *     for the AI generation prompt guidance and the DB CHECK value.
 */
export const SEO_TITLE_MAX_LENGTH = 60;
