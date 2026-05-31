'use client'

/**
 * Public-facing detail view for `/onboarding-guides/<slug>` on
 * openframe.
 *
 * Self-contained: every concern that used to require a hub-side
 * wrapper now flows through lib primitives + the ChatRuntime context.
 *
 *   - Markdown: lib `<SimpleMarkdownRenderer>` (already lib-resident).
 *   - Video warmup: lib `useVideoWarmup` (reads Supabase storage
 *     origin from `runtime.endpoints.supabaseStorageOrigin`; Mux
 *     origins are hardcoded public CDN hosts).
 *   - Captions URL: lib `getCaptionsUrl` (pure URL builder).
 *   - Video poster: inline priority chain
 *     (`main_video_thumbnail || featured_image || og_image_url`) —
 *     same fallbacks the card uses.
 *   - Related card hrefs: `runtime.composeContentUrl?.(
 *     'onboarding_guide', slug, platforms)` — falls back to same-
 *     origin relative path when no composer is wired.
 *
 * No hub-side wrapper file required. Optional `MarkdownRenderer`
 * prop lets hosts swap in a renderer with extra plugins (Reddit /
 * Twitter / X embeds) when needed.
 */

import { type ComponentType, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Link } from '../../embed-shims'
import { ArticleDetailLayout } from '../layout/article-detail-layout'
import { EntityVideoSection } from '../features/entity-video-section'
import { VideoBitesDisplay } from '../features/video-bites-display'
import { useVideoWarmup } from '../features/use-video-warmup'
import { getCaptionsUrl } from '../features/captions-url'
import { SimpleMarkdownRenderer } from '../ui/simple-markdown-renderer'
import { EntityAuthorCard } from '../chat/entity-cards/entity-author-card'
import { OnboardingGuideCard } from '../chat/entity-cards/onboarding-guide-card'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide'
import type { VideoTeaser } from '../../types/video-processing'
import { buildDefaultHref } from '../../utils/content-href'

export interface OnboardingGuideDetailViewProps {
  initialData: OnboardingGuide
  related?: OnboardingGuide[]
  /** Optional markdown renderer override. Defaults to lib
   *  `<SimpleMarkdownRenderer>`. Hosts override when they need extra
   *  plugins (Reddit / Twitter / X / code-block enhancements). */
  MarkdownRenderer?: ComponentType<{ content: string }>
  /** Optional per-row related-card renderer override. When omitted,
   *  lib renders `<OnboardingGuideCard>` with runtime-composed href. */
  renderRelatedCard?: (guide: OnboardingGuide) => ReactNode
  /** Back-link target. Defaults to `basePath` so the link returns to
   *  the catalog the embedder is hosting (no drift when `basePath`
   *  is overridden). The admin preview explicitly overrides to
   *  `/admin/onboarding-guides`. */
  backHref?: string
  /** Back-link label. Defaults to "Back to Getting Started". */
  backLabel?: string
  /** Base path the related-card hrefs default to when
   *  `runtime.composeContentUrl` is not wired. Embedders mounting at
   *  `/docs/onboarding/` instead of `/onboarding-guides/` should
   *  override. Default `/onboarding-guides`. */
  basePath?: string
}

export function OnboardingGuideDetailView({
  initialData: guide,
  related = [],
  MarkdownRenderer = SimpleMarkdownRenderer,
  renderRelatedCard,
  backHref,
  backLabel = 'Back to Getting Started',
  basePath = '/onboarding-guides',
}: OnboardingGuideDetailViewProps) {
  // Resolve `backHref` from `basePath` when not explicitly set — so
  // an embedder overriding `basePath="/docs/onboarding"` automatically
  // gets the right back link without remembering to thread `backHref`
  // too. Admin preview still wins via its explicit `backHref` override.
  const resolvedBackHref = backHref ?? basePath
  const runtime = useChatRuntime()

  // Video warmup — preconnect always fires; preload only when the
  // container scrolls within ~1 viewport AND the URL is on the
  // configured Supabase storage origin. No origin in runtime ⇒
  // preconnect-only path (Mux/YouTube unaffected).
  const { ref: videoWarmupRef } = useVideoWarmup<HTMLDivElement>({
    videoUrl: guide.main_video_url,
    supabaseStorageOrigin: runtime?.endpoints.supabaseStorageOrigin,
  })

  const captionsUrl = getCaptionsUrl(
    'onboarding_guide',
    guide.id,
    guide.srt_content,
  )

  // Video poster — fallback chain:
  //   1. Entity-owned thumbnails (main_video_thumbnail / featured_image / og_image_url)
  //   2. Branded OG placeholder from `runtime.resolvePlaceholderUrl(title)`
  //      — restores the hub's prior behavior where a video without a
  //      thumbnail still showed a branded poster instead of a black
  //      frame.
  //   3. `undefined` (player picks its own default poster — usually
  //      first-frame extraction).
  const videoPoster =
    guide.main_video_thumbnail ||
    guide.featured_image ||
    guide.og_image_url ||
    runtime?.resolvePlaceholderUrl?.(guide.title, { aspect: 'wide' }) ||
    undefined

  // Default related-card renderer — runtime-composed cross-platform href.
  const defaultRenderRelatedCard = (g: OnboardingGuide) => {
    const cta = runtime?.composeContentUrl
      ? runtime.composeContentUrl(
          'onboarding_guide',
          g.slug,
          g.onboarding_guide_platforms,
        )
      : buildDefaultHref(basePath, g.slug)
    return (
      <OnboardingGuideCard
        guide={g}
        href={cta.href}
        targetPlatform={cta.targetPlatform}
      />
    )
  }
  const renderRelatedCardFn = renderRelatedCard ?? defaultRenderRelatedCard

  return (
    <ArticleDetailLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Back link */}
        <Link
          href={resolvedBackHref}
          className="inline-flex items-center gap-2 text-ods-text-secondary hover:text-ods-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-h5">{backLabel}</span>
        </Link>

        <h1 className="text-h1 tracking-[-1.12px] text-ods-text-primary">
          {guide.title}
        </h1>

        {/* Metadata grid — Section · Step | Published | Author. */}
        <EntityAuthorCard
          author={guide.author}
          publishedAt={guide.published_at}
          extraCells={[
            {
              value: `${guide.section} · Step ${guide.step_order}`,
              label: 'Section',
              uppercase: false,
            },
          ]}
        />

        {/* Video. `main_video_url` (Mux/MP4) and `youtube_url` are
            independent columns — either one populated should render
            the player. `EntityVideoSection` routes accordingly. */}
        {(guide.main_video_url || guide.youtube_url) && (
          <div ref={videoWarmupRef}>
            <EntityVideoSection
              mainVideoUrl={guide.main_video_url}
              youtubeUrl={guide.youtube_url || undefined}
              highlightVideoUrl={guide.highlight_video_url}
              mainVideoPoster={videoPoster}
              highlightVideoThumbnail={guide.highlight_video_thumbnail || undefined}
              videoSummary={undefined}
              videoBites={undefined}
              title={guide.title}
              srtContent={guide.srt_content}
              captionsUrl={captionsUrl}
              MarkdownRenderer={MarkdownRenderer}
            />
          </div>
        )}

        {/* Markdown body */}
        {guide.content && (
          <div className="space-y-4">
            <MarkdownRenderer content={guide.content} />
          </div>
        )}

        {/* Video Bites */}
        {guide.video_bites && guide.video_bites.length > 0 && (
          <VideoBitesDisplay
            bites={guide.video_bites as VideoTeaser[]}
            filterPublished={true}
            showTitle={false}
          />
        )}

        {/* Related — same-section, ordered by step. */}
        {related.length > 0 && (
          <div className="space-y-4 pt-8 border-t border-ods-border">
            <h2 className="text-h3 tracking-[-0.36px] text-ods-text-primary">
              More in {guide.section}
            </h2>
            <ul className="flex flex-col gap-3">
              {related.map((r) => (
                <li key={r.id}>{renderRelatedCardFn(r)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ArticleDetailLayout>
  )
}
