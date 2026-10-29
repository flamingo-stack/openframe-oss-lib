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
 *
 * LOADING: the view is its own loading state. While the guide is read (or in a host's loading scope) it renders the
 * SAME page over an empty guide (`EMPTY_ONBOARDING_GUIDE`, or the host's empty placeholder) inside a `LoadingScope`:
 * the title block, the tags, the metadata grid, the body, the byline and the related guides each draw their own
 * skeleton; the back button and the static labels are real. Parts a guide may not have (its video, its bites) are left
 * out while loading and carry `data-loading-optional` once loaded.
 */

import { Fragment, type ComponentType, type ReactNode } from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { useRouter } from '../../embed-shims';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import type { VideoTeaser } from '../../types/video-processing';
import { resolveContentHref } from '../../utils/content-href';
import { buildOgPlaceholderUrl } from '../../utils/og-placeholder';
import { EntityAuthorCard } from '../chat/entity-cards/entity-author-card';
import { OnboardingGuideCard } from '../chat/entity-cards/onboarding-guide-card';
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide';
import { EntityTagBadges } from '../features/entity-tag-badges';
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
import { LoadingFallback } from '../loading/loading-fallback';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { ArticleAuthorByline } from '../shared/article-author-byline';
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
/** Related guide cards the related block's skeleton draws (a guide's first fold). */
export const ONBOARDING_GUIDE_RELATED_SKELETON_COUNT = 3;

/** The guide the view renders while it is read: every field empty, so each part draws its own skeleton. */
const EMPTY_ONBOARDING_GUIDE: OnboardingGuide = {
  id: '',
  title: '',
  slug: '',
  section: '',
  step_order: 0,
  section_order: 0,
  content: '',
  video_summary: null,
  transcript: null,
  transcript_words_data: null,
  srt_content: null,
  ai_transcript_formatted: null,
  main_video_url: null,
  main_video_thumbnail: null,
  youtube_url: null,
  highlight_video_url: null,
  highlight_video_thumbnail: null,
  highlight_video_duration_ms: null,
  highlight_video_source: null,
  video_bites: [],
  featured_image: null,
  og_image_url: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  status: 'published',
  published_at: null,
  author_id: null,
  custom_instructions: null,
  config: null,
  ai_effort_score: null,
  onboarding_guide_tags: [],
  created_at: '',
  updated_at: '',
  created_by: null,
  updated_by: null,
};

/**
 * The same-section guides under the article: "More in <section>" over their cards, each a read list item. While the
 * guide is read (`useLoadingScope()`) it renders a fold of empty guides, whose cards draw their own skeletons, under
 * the heading's real words with the section as a bar.
 */
function RelatedGuides({
  section,
  related,
  renderCard,
}: {
  section: string;
  related: OnboardingGuide[];
  renderCard: (guide: OnboardingGuide) => ReactNode;
}) {
  const loading = useLoadingScope();
  const guides = loading
    ? Array.from({ length: ONBOARDING_GUIDE_RELATED_SKELETON_COUNT }, (_, i) => ({
        ...EMPTY_ONBOARDING_GUIDE,
        id: `skeleton-${i}`,
      }))
    : related;
  if (guides.length === 0) return null;
  return (
    <div className={RELATED_BLOCK_CLASS}>
      <h2 className={RELATED_HEADING_CLASS}>
        More in{' '}
        {loading ? <TextLineSkeleton type="inherit" as="span" className="inline-block w-32 align-middle" /> : section}
      </h2>
      <ul className={RELATED_LIST_CLASS}>
        {guides.map(guide => (
          <li key={guide.id} data-loading-item>
            {renderCard(guide)}
          </li>
        ))}
      </ul>
    </div>
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
  const {
    data: guide,
    isLoading,
    error,
    reload,
  } = useSelfFetch<OnboardingGuide>(scoped ? null : url, {
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
  if (!loading && (error || !guide)) {
    return renderShell(<LoadError message="Guide not found." onRetry={reload} />);
  }
  // While loading: the host's empty placeholder (in its scope) or the view's own empty guide.
  const view = guide ?? EMPTY_ONBOARDING_GUIDE;

  // Track URLs via the ONE captions configurer (`useCaptions`); same-origin
  // hosts get the relative `/api/captions/...` default. Zero per-page wiring.
  const { captionsUrl, highlightCaptionsUrl } = captions.forEntity('onboarding_guide', view);

  const videoPoster =
    view.main_video_thumbnail ||
    view.featured_image ||
    view.og_image_url ||
    // `buildOgPlaceholderUrl` always returns a usable string (relative route at
    // worst), so it's the terminal fallback — no trailing `|| undefined` needed.
    buildOgPlaceholderUrl(runtime?.endpoints, view.title, { aspect: 'wide' });

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

  const page = (
    <PageLayout title={view.title} loading={loading} titleSize="h1" titleWrap backButton={backCfg}>
      {/* Tags — flat onboarding_guide_tags[] from entity_tags. */}
      <EntityTagBadges tags={view.onboarding_guide_tags} />

      {/* Metadata grid — Section · Step | Published | Author. */}
      <EntityAuthorCard
        author={view.author}
        authorHref={authorHref}
        publishedAt={view.published_at}
        extraCells={[
          {
            value: `${view.section} · Step ${view.step_order}`,
            label: SECTION_CELL_LABEL,
            uppercase: false,
          },
        ]}
      />

      {/* Video. `main_video_url` (Mux/MP4) and `youtube_url` are independent
            columns — either populated renders the player. */}
      {!loading && (view.main_video_url || view.youtube_url) && (
        // A guide's video is optional: the loading state leaves it out.
        <div ref={videoWarmupRef} data-loading-optional="">
          <EntityVideoSection
            mainVideoUrl={view.main_video_url}
            youtubeUrl={view.youtube_url || undefined}
            highlightVideoUrl={view.highlight_video_url}
            mainVideoPoster={videoPoster}
            highlightVideoThumbnail={view.highlight_video_thumbnail || undefined}
            videoSummary={undefined}
            videoBites={undefined}
            title={view.title}
            captionsUrl={captionsUrl}
            highlightCaptionsUrl={highlightCaptionsUrl}
            MarkdownRenderer={MarkdownRenderer}
          />
        </div>
      )}

      {/* Markdown body (in the loading scope, the renderer's own skeleton) */}
      {(loading || view.content) && (
        <div className={BODY_CLASS}>
          <MarkdownRenderer content={view.content ?? ''} />
        </div>
      )}

      {/* Video Bites — unified strip; renders nothing when no published bites. Optional per guide: the loading state
          leaves it out (no box of its own: `contents`). */}
      {loading ? null : (
        <div className="contents" data-loading-optional="">
          <VideoBitesStrip
            bites={(view.video_bites as VideoTeaser[] | null) ?? []}
            filterPublished={true}
            showTitle={false}
            profile={toStripProfile(view.author)}
            href={`/onboarding-guides/${view.slug}`}
          />
        </div>
      )}

      {/* End-of-article author byline (avatar + linked name + bio) — the
            author DESCRIPTION block every article-shaped detail page renders.
            Hidden when the guide has no author (the byline returns null). */}
      <ArticleAuthorByline
        author={view.author?.full_name ?? null}
        avatar={view.author?.avatar_url}
        jobTitle={view.author?.job_title}
        bio={authorBio ?? view.author?.about}
        href={authorHref}
        fallbackBio={fallbackBio}
      />

      {/* Related — same-section, ordered by step. */}
      <RelatedGuides section={view.section} related={related} renderCard={renderRelatedCardFn} />

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
    </PageLayout>
  );
  // The loading state is the page itself in a scope, announced once unless a host's scope already did.
  return renderShell(loading ? <LoadingFallback label="Loading the guide">{page}</LoadingFallback> : page);
}
