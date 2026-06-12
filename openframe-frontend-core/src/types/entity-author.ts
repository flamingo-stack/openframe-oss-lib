/**
 * Hydrated content author — THE shared author shape attached to detail rows
 * by the hub's `hydrateAuthor` (product releases, onboarding guides) and the
 * per-entity author joins. One type for every author surface: metadata-grid
 * author cells, bylines, author-page hrefs.
 */
export interface EntityAuthor {
  id?: string
  full_name: string | null
  avatar_url: string | null
  job_title?: string | null
  /** Author bio paragraph (`profiles.about`) — feeds the end-of-article
   *  `<ArticleAuthorByline bio>` on every detail page with an author. */
  about?: string | null
  /** Public author-page slug — present only when the hub's public-author
   *  gate passes (`is_real` profiles only). Feeds /authors/[slug] links. */
  slug?: string
  /** Present only on server/admin payloads — public DALs strip it. */
  email?: string | null
}
