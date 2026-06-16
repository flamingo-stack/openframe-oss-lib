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

/** One curated social link on an author profile (host junction:
 *  `profile_social_links` ordered by display_order in the hub). */
export interface AuthorSocialLink {
  /** Platform key fed to `SocialIconRow` (e.g. 'linkedin', 'x'). */
  platform: string
  url: string
  username?: string | null
}

/**
 * Public author-page view model — what `<AuthorDetailView>` renders. The
 * hub's `PublicAuthor` (authors DAL) extends this with server-side extras
 * (`updatedAt`); embedders construct it from whatever directory they have.
 */
export interface AuthorProfile {
  id: string
  slug: string
  fullName: string
  avatarUrl: string | null
  about: string | null
  jobTitle: string | null
  company: string | null
  knowsAbout: string[]
  /** Ordered by display_order. */
  socialLinks: AuthorSocialLink[]
}
