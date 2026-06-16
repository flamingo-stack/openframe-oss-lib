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
import { PageLayout } from '../layout/page-layout'

import { useRouter } from '../../embed-shims'
// PageShell (max-w-[1920px]) — the guide detail content must share the SAME
// container sizing as the related-content/FAQ rail the host page renders
// below it (which uses the wide shell). ArticleDetailLayout (1280px) made
// the detail block visibly narrower than the rail.
import { PageShell } from '../layout/article-detail-layout'
import { DetailPageSkeleton } from '../shared/detail-page-skeleton'
import { EntityVideoSection } from '../features/entity-video-section'
import { VideoBitesDisplay } from '../features/video-bites-display'
import { useVideoWarmup } from '../features/use-video-warmup'
import { getCaptionsUrl } from '../features/captions-url'
import { SimpleMarkdownRenderer } from '../ui/simple-markdown-renderer'
import { EntityTagBadges } from '../features/entity-tag-badges'
import { LoadError } from '../ui/error-state'
import { ArticleAuthorByline } from '../shared/article-author-byline'
import { EntityAuthorCard } from '../chat/entity-cards/entity-author-card'
import { OnboardingGuideCard } from '../chat/entity-cards/onboarding-guide-card'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide'
import type { VideoTeaser } from '../../types/video-processing'
import { resolveContentHref } from '../../utils/content-href'
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
  /** Link target for the author name in the metadata grid — the host
   *  computes it (public author page; absent ⇒ plain text). */
  authorHref?: string
  /** Bio paragraph for the end-of-article author byline. Defaults to the
   *  guide payload's `author.about` (hubs that hydrate it can omit this). */
  authorBio?: string | null
  /** Byline fallback paragraph when the bio is empty — the host passes its
   *  platform-aware copy (the lib has no config awareness). Absent ⇒ the
   *  byline renders nothing below the name when the bio is empty. */
  fallbackBio?: string | null
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
  authorHref,
  authorBio,
  fallbackBio,
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
  const router = useRouter()

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
    return (
      <PageShell>
        <LoadError message="Guide not found." onRetry={reload} />
      </PageShell>
    )
  }
  if (!guide) {
    // Skeleton (not a bare "Loading…") for parity with every other shared view —
    // catalog, roadmap, releases all render a skeleton on first load, so the detail
    // page shouldn't flash text then content. `bare` + `PageShell` so the loading
    // state matches the loaded page's full width / padding / min-height.
    return (
      <PageShell>
        {/* Match the loaded page's top offset (TitleBlock's
            `pt-[var(--spacing-system-l)]`) so content doesn't jump on load. */}
        <div className="pt-[var(--spacing-system-l)]">
          <DetailPageSkeleton bare showImageGallery={false} />
        </div>
      </PageShell>
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
    const cta = resolveContentHref(runtime?.composeContentUrl, {
      type: 'onboarding_guide',
      slug: g.slug,
      basePath,
      platforms: g.onboarding_guide_platforms,
    })
    return <OnboardingGuideCard guide={g} href={cta.href} targetPlatform={cta.targetPlatform} />
  }
  const renderRelatedCardFn = renderRelatedCard ?? defaultRenderRelatedCard

  return (
    <PageShell>
      <PageLayout backButton={{ label: backLabel, onClick: () => router.push(resolvedBackHref) }}>
        <h1 className="text-h1 tracking-[-1.12px] text-ods-text-primary">{guide.title}</h1>

        {/* Tags — flat onboarding_guide_tags[] from entity_tags. */}
        <EntityTagBadges tags={(guide as any).onboarding_guide_tags} />

        {/* Metadata grid — Section · Step | Published | Author. */}
        <EntityAuthorCard
          author={guide.author}
          authorHref={authorHref}
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

        {/* End-of-article author byline (avatar + linked name + bio) — the
            author DESCRIPTION block every article-shaped detail page renders.
            Hidden when the guide has no author (the byline returns null). */}
        <ArticleAuthorByline
          author={guide.author?.full_name ?? null}
          avatar={guide.author?.avatar_url}
          jobTitle={guide.author?.job_title}
          bio={authorBio ?? guide.author?.about}
          href={authorHref}
          fallbackBio={fallbackBio}
        />

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
      </PageLayout>
    </PageShell>
  )
}
