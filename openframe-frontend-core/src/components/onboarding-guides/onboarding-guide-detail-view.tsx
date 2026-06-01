'use client'

/**
 * Public-facing detail view for `/onboarding-guides/<slug>`.
 *
 * Two modes:
 *   - **controlled** (hub SSR): pass `initialData` (a server-fetched guide).
 *   - **self-fetching** (config-only embed): pass `slug` + `guideEndpoint`
 *     (the api route) and the view fetches the guide itself — no host data
 *     layer. (Plain fetch + useEffect, the DeliveryLists pattern.)
 *
 * Everything else flows through lib primitives + the ChatRuntime context
 * (markdown, video warmup, captions, related-card hrefs via
 * `runtime.composeContentUrl`). Optional `MarkdownRenderer` lets hosts swap a
 * renderer with extra plugins.
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
import { LoadError } from '../ui/error-state'
import { EntityAuthorCard } from '../chat/entity-cards/entity-author-card'
import { OnboardingGuideCard } from '../chat/entity-cards/onboarding-guide-card'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide'
import type { VideoTeaser } from '../../types/video-processing'
import { buildDefaultHref } from '../../utils/content-href'
import { useSelfFetch } from '../../hooks/use-self-fetch'

export interface OnboardingGuideDetailViewProps {
  /** Server-fetched guide (controlled / SSR mode). Omit it and pass
   *  `slug` + `guideEndpoint` for the self-fetching config-only mode. */
  initialData?: OnboardingGuide
  /** Self-fetch: the guide's slug (the host reads it from its route). */
  slug?: string
  /** Self-fetch: builds the GET url for a single guide (the api route).
   *  e.g. `(s) => \`/content/api/onboarding-guides/${s}\``. */
  guideEndpoint?: (slug: string) => string
  related?: OnboardingGuide[]
  /** Optional markdown renderer override. Defaults to lib
   *  `<SimpleMarkdownRenderer>`. */
  MarkdownRenderer?: ComponentType<{ content: string }>
  /** Optional per-row related-card renderer override. */
  renderRelatedCard?: (guide: OnboardingGuide) => ReactNode
  /** Back-link target. Defaults to `basePath`. */
  backHref?: string
  /** Back-link label. Defaults to "Back to Getting Started". */
  backLabel?: string
  /** Base path the related-card hrefs default to when
   *  `runtime.composeContentUrl` is not wired. Default `/onboarding-guides`. */
  basePath?: string
}

export function OnboardingGuideDetailView({
  initialData,
  slug,
  guideEndpoint,
  related = [],
  MarkdownRenderer = SimpleMarkdownRenderer,
  renderRelatedCard,
  backHref,
  backLabel = 'Back to Getting Started',
  basePath = '/onboarding-guides',
}: OnboardingGuideDetailViewProps) {
  const resolvedBackHref = backHref ?? basePath
  const runtime = useChatRuntime()

  // Controlled (hub SSR `initialData`) OR self-fetch by slug (config-only embed).
  const url = initialData ? null : slug && guideEndpoint ? guideEndpoint(slug) : null
  const { data: guide, isLoading, error, reload } = useSelfFetch<OnboardingGuide>(url, { initialData })

  // Hooks must run unconditionally — feed them optional-chained values so they
  // no-op while the guide is still loading.
  const { ref: videoWarmupRef } = useVideoWarmup<HTMLDivElement>({
    videoUrl: guide?.main_video_url,
    supabaseStorageOrigin: runtime?.endpoints.supabaseStorageOrigin,
  })

  if (error || (!guide && !isLoading)) {
    return <LoadError message="Guide not found." onRetry={reload} />
  }
  if (!guide) {
    return (
      <ArticleDetailLayout>
        <div className="py-16 text-center text-ods-text-secondary">Loading…</div>
      </ArticleDetailLayout>
    )
  }

  const captionsUrl = getCaptionsUrl('onboarding_guide', guide.id, guide.srt_content)

  const videoPoster =
    guide.main_video_thumbnail ||
    guide.featured_image ||
    guide.og_image_url ||
    runtime?.resolvePlaceholderUrl?.(guide.title, { aspect: 'wide' }) ||
    undefined

  const defaultRenderRelatedCard = (g: OnboardingGuide) => {
    const cta = runtime?.composeContentUrl
      ? runtime.composeContentUrl('onboarding_guide', g.slug, g.onboarding_guide_platforms)
      : buildDefaultHref(basePath, g.slug)
    return <OnboardingGuideCard guide={g} href={cta.href} targetPlatform={cta.targetPlatform} />
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

        <h1 className="text-h1 tracking-[-1.12px] text-ods-text-primary">{guide.title}</h1>

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

        {/* Video. `main_video_url` (Mux/MP4) and `youtube_url` are independent
            columns — either populated renders the player. */}
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
