'use client';

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

import { Fragment, type ComponentType, type ReactNode } from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { useRouter } from '../../embed-shims';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import type { VideoTeaser } from '../../types/video-processing';
import { resolveContentHref } from '../../utils/content-href';
import { buildOgPlaceholderUrl } from '../../utils/og-placeholder';
import { EntityAuthorCard, EntityAuthorCardSkeleton } from '../chat/entity-cards/entity-author-card';
import { OnboardingGuideCard, OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card';
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide';
import { EntityTagBadges, EntityTagBadgesSkeleton } from '../features/entity-tag-badges';
import { EntityVideoSection } from '../features/entity-video-section';
import { useCaptions } from '../features/use-captions';
import { useVideoWarmup } from '../features/use-video-warmup';
import { toStripProfile } from '../features/video-bites-shared';
import { VideoBitesStrip } from '../features/video-bites-strip';
// PageShell (max-w-[1920px]) — the guide detail content must share the SAME
// container sizing as the related-content/FAQ rail the host page renders
// below it (which uses the wide shell). ArticleDetailLayout (1280px) made
// the detail block visibly narrower than the rail.
import { PageShell } from '../layout/article-detail-layout';
import { PageLayout } from '../layout/page-layout';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { ArticleAuthorByline, ArticleAuthorBylineSkeleton } from '../shared/article-author-byline';
import { LoadError } from '../ui/error-state';
import { useLoadingScope } from '../ui/loading-scope';
import { RichMarkdownRenderer } from '../ui/markdown';

export interface OnboardingGuideDetailViewProps {
  /** Server-fetched guide (controlled / SSR mode). Omit it and pass
   *  `slug` + `guideEndpoint` for the self-fetching config-only mode. */
  initialData?: OnboardingGuide;
  /** Self-fetch: the guide's slug (the host reads it from its route). */
  slug?: string;
  /** Self-fetch: builds the GET url for a single guide (the api route).
   *  e.g. `(s) => \`/content/api/onboarding-guides/${s}\``. */
  guideEndpoint?: (slug: string) => string;
  related?: OnboardingGuide[];
  /** Link target for the author name in the metadata grid — the host
   *  computes it (public author page; absent ⇒ plain text). */
  authorHref?: string;
  /** Bio paragraph for the end-of-article author byline. Defaults to the
   *  guide payload's `author.about` (hubs that hydrate it can omit this). */
  authorBio?: string | null;
  /** Byline fallback paragraph when the bio is empty — the host passes its
   *  platform-aware copy (the lib has no config awareness). Absent ⇒ the
   *  byline renders nothing below the name when the bio is empty. */
  fallbackBio?: string | null;
  /** Optional markdown renderer override. Defaults to lib
   *  `<RichMarkdownRenderer>`. */
  MarkdownRenderer?: ComponentType<{ content: string }>;
  /** Optional per-row related-card renderer override. */
  renderRelatedCard?: (guide: OnboardingGuide) => ReactNode;
  /** Back-link target. Defaults to `basePath`. */
  backHref?: string;
  /** Back-link label. Defaults to "Back to Getting Started". */
  backLabel?: string;
  /** Base path the related-card hrefs default to when
   *  `runtime.composeContentUrl` is not wired. Default `/onboarding-guides`. */
  basePath?: string;
  /** Optional slot rendered inside the page chrome, BELOW the article + related
   *  guides — e.g. the hub's cross-type related-content / FAQ rail. Lets the hub
   *  mount this view directly (no local wrapper); embedders omit it. */
  relatedContent?: ReactNode;
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container — only the padding box renders,
   *  avoiding a nested `<main>`. */
  shell?: boolean;
}

/** The view's layout, read by the view and by its skeleton, so the skeleton is the view's size. */
const RELATED_BLOCK_CLASS = 'space-y-4 border-t border-ods-border pt-8';
const RELATED_HEADING_CLASS = 'tracking-[-0.36px] text-ods-text-primary text-h3';
const RELATED_LIST_CLASS = 'flex flex-col gap-3';
const BODY_CLASS = 'space-y-4';
/** The metadata grid's extra cell label (static copy). */
const SECTION_CELL_LABEL = 'Section';
/** Related guides and body paragraphs the skeleton draws (a guide's first fold). */
export const ONBOARDING_GUIDE_RELATED_SKELETON_COUNT = 3;
const ONBOARDING_GUIDE_BODY_SKELETON_PARAGRAPHS = 3;

export interface OnboardingGuideDetailViewSkeletonProps {
  /** The real back button (static copy). */
  backButton?: { label?: string; onClick: () => void };
  /** Related guide cards drawn. Default `ONBOARDING_GUIDE_RELATED_SKELETON_COUNT`; 0 draws no related block. */
  relatedCount?: number;
  /** The host's slot below the guide, drawn as is. */
  children?: ReactNode;
}

/**
 * The guide page while its guide is read: the title as a bar in the page's own title block (the back button real),
 * the tag row, the metadata grid (real "Section" / "Published" labels), body paragraphs, the author byline, and the
 * related block ("More in" real, the section a bar, guide card skeletons). Rendered inside the caller's shell.
 */
export function OnboardingGuideDetailViewSkeleton({
  backButton,
  relatedCount = ONBOARDING_GUIDE_RELATED_SKELETON_COUNT,
  children,
}: OnboardingGuideDetailViewSkeletonProps) {
  return (
    <PageLayout loading titleSize="h1" titleWrap backButton={backButton}>
      <EntityTagBadgesSkeleton />
      <EntityAuthorCardSkeleton extraCellLabels={[SECTION_CELL_LABEL]} />
      <div className={BODY_CLASS} aria-hidden>
        {Array.from({ length: ONBOARDING_GUIDE_BODY_SKELETON_PARAGRAPHS }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton paragraphs never reorder
          <TextLineSkeleton key={i} type="h4" lines={3} className="w-full" />
        ))}
      </div>
      <ArticleAuthorBylineSkeleton />
      {relatedCount > 0 && (
        <div className={RELATED_BLOCK_CLASS} aria-hidden>
          <h2 className={RELATED_HEADING_CLASS}>
            More in <TextLineSkeleton type="inherit" as="span" className="inline-block w-32 align-middle" />
          </h2>
          <ul className={RELATED_LIST_CLASS}>
            {Array.from({ length: relatedCount }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cards never reorder
              <li key={i}>
                <OnboardingGuideCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      )}
      <Fragment key="related-content">{children}</Fragment>
    </PageLayout>
  );
}

export function OnboardingGuideDetailView({
  authorHref,
  authorBio,
  fallbackBio,
  initialData,
  slug,
  guideEndpoint,
  related = [],
  MarkdownRenderer = RichMarkdownRenderer,
  renderRelatedCard,
  backHref,
  backLabel = 'Back to Getting Started',
  basePath = '/onboarding-guides',
  relatedContent,
  shell = true,
}: OnboardingGuideDetailViewProps) {
  const resolvedBackHref = backHref ?? basePath;
  const runtime = useChatRuntime();
  const captions = useCaptions();
  const router = useRouter();
  // `shell` true → standalone `<PageShell>`; false → padding-only box (no nested
  // <main>) for hosts whose layout already provides the container.
  const renderShell = (node: ReactNode) =>
    shell ? <PageShell>{node}</PageShell> : <div className="page-shell-content">{node}</div>;

  // Controlled (hub SSR `initialData`) OR self-fetch by slug (config-only embed).
  const url = initialData ? null : slug && guideEndpoint ? guideEndpoint(slug) : null;
  // In a page's loading state the guide is read (the host passes an empty record): nothing is fetched.
  const scoped = useLoadingScope();
  const { data: guide, isLoading, error, reload } = useSelfFetch<OnboardingGuide>(scoped ? null : url, {
    initialData,
  });

  // Hooks must run unconditionally — feed them optional-chained values so they
  // no-op while the guide is still loading.
  const { ref: videoWarmupRef } = useVideoWarmup<HTMLDivElement>({
    videoUrl: guide?.main_video_url,
    supabaseStorageOrigin: runtime?.endpoints.supabaseStorageOrigin,
  });

  const backCfg = { label: backLabel, onClick: () => router.push(resolvedBackHref) };
  const loading = scoped || (!guide && isLoading);
  if (loading) {
    return renderShell(
      <OnboardingGuideDetailViewSkeleton backButton={backCfg}>{relatedContent}</OnboardingGuideDetailViewSkeleton>,
    );
  }
  if (error || !guide) {
    return renderShell(<LoadError message="Guide not found." onRetry={reload} />);
  }

  // Track URLs via the ONE captions configurer (`useCaptions`); same-origin
  // hosts get the relative `/api/captions/...` default. Zero per-page wiring.
  const { captionsUrl, highlightCaptionsUrl } = captions.forEntity('onboarding_guide', guide);

  const videoPoster =
    guide.main_video_thumbnail ||
    guide.featured_image ||
    guide.og_image_url ||
    // `buildOgPlaceholderUrl` always returns a usable string (relative route at
    // worst), so it's the terminal fallback — no trailing `|| undefined` needed.
    buildOgPlaceholderUrl(runtime?.endpoints, guide.title, { aspect: 'wide' });

  const defaultRenderRelatedCard = (g: OnboardingGuide) => {
    const cta = resolveContentHref(runtime?.composeContentUrl, {
      type: 'onboarding_guide',
      slug: g.slug,
      basePath,
      platforms: g.onboarding_guide_platforms,
    });
    return <OnboardingGuideCard guide={g} href={cta.href} targetPlatform={cta.targetPlatform} />;
  };
  const renderRelatedCardFn = renderRelatedCard ?? defaultRenderRelatedCard;

  return renderShell(
    <PageLayout
      title={guide.title}
      titleSize="h1"
      titleWrap
      backButton={backCfg}
    >
      {/* Tags — flat onboarding_guide_tags[] from entity_tags. */}
      <EntityTagBadges tags={guide.onboarding_guide_tags} />

      {/* Metadata grid — Section · Step | Published | Author. */}
      <EntityAuthorCard
        author={guide.author}
        authorHref={authorHref}
        publishedAt={guide.published_at}
        extraCells={[
          {
            value: `${guide.section} · Step ${guide.step_order}`,
            label: SECTION_CELL_LABEL,
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
            captionsUrl={captionsUrl}
            highlightCaptionsUrl={highlightCaptionsUrl}
            MarkdownRenderer={MarkdownRenderer}
          />
        </div>
      )}

      {/* Markdown body */}
      {guide.content && (
        <div className={BODY_CLASS}>
          <MarkdownRenderer content={guide.content} />
        </div>
      )}

      {/* Video Bites — unified strip; renders nothing when no published bites. */}
      <VideoBitesStrip
        bites={(guide.video_bites as VideoTeaser[] | null) ?? []}
        filterPublished={true}
        showTitle={false}
        profile={toStripProfile(guide.author)}
        href={`/onboarding-guides/${guide.slug}`}
      />

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
        <div className={RELATED_BLOCK_CLASS}>
          <h2 className={RELATED_HEADING_CLASS}>More in {guide.section}</h2>
          <ul className={RELATED_LIST_CLASS}>
            {related.map(r => (
              <li key={r.id}>{renderRelatedCardFn(r)}</li>
            ))}
          </ul>
        </div>
      )}

      {/*
       * Host slot — cross-type related-content / FAQ rail.
       *
       * KEYED DELIBERATELY. This is one member of PageLayout's static children
       * array, and the only member whose element may be created in a SERVER
       * component and crossed over the RSC boundary. Static JSX children are
       * normally exempt from the key warning because `jsxs` runs
       * `validateChildKeys` and stamps `_store.validated = 1` on each element —
       * but a slot arriving over the wire is referenced as a lazy chunk wrapper,
       * so validation marks the WRAPPER and the fulfilled path never copies the
       * flag onto the revived element. It reaches the reconciler with
       * `validated: 0, key: null` and warns, blaming PageLayout (the owner of the
       * enclosing element) rather than anything actually at fault.
       *
       * A keyed Fragment emits no DOM, so rendered output is byte-identical.
       * Do NOT "fix" this in PageLayout via `React.Children.toArray` — that would
       * auto-key every consumer's children and change reconciliation identity for
       * all of them, and that file carries an explicit FROZEN contract.
       */}
      <Fragment key="related-content">{relatedContent}</Fragment>
    </PageLayout>,
  );
}
