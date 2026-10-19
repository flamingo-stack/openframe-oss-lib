'use client';

import { AlertTriangle, ExternalLink, BookMarked, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import { useState, useEffect, Fragment, type ComponentType, type ReactNode } from 'react';
import Link from '../../../embed-shims/next-link';
import { useRouter } from '../../../embed-shims/next-navigation';
// PageShell (wide) — match the related-content/FAQ rail container the hub
// renders below this view (was ArticleDetailLayout, 1280px — narrower than
// the rail, see hub detail-container alignment decision 2026-06-10).
import { useSelfFetch } from '../../../hooks/use-self-fetch';
import type { TagAssoc } from '../../../types/blog';
import type { EntityAuthor } from '../../../types/entity-author';
import type { ChangelogEntry } from '../../../types/product-release';
import type { VideoTeaser } from '../../../types/video-processing';
import { formatReleaseDate } from '../../../utils/date-formatters';
import { contentFetch } from '../../../utils/embed-content-fetch';
import { EntityMetadataAuthorCell, EntityMetadataValueCell } from '../../chat/entity-cards/entity-author-card';
import type { CaptionSrtFields } from '../../features/captions-url';
import { EntityTagBadges } from '../../features/entity-tag-badges';
import { useCaptions } from '../../features/use-captions';
import { Video } from '../../features/video';
import {
  DEFAULT_VIDEO_BITES_TITLE,
  toStripProfile,
  type VideoBiteStripProfile,
} from '../../features/video-bites-shared';
import { GithubClassicIcon } from '../../icons-v2-generated/brand-logos/github-classic-icon';
import { PageShell } from '../../layout/article-detail-layout';
import { PageLayout } from '../../layout/page-layout';
import { LoadingRegion } from '../../loading/loading-region';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { Card, CardContent } from '../../ui/card';
import { FadePreview } from '../../ui/fade-preview';
import { LoadingScope, useLoadingScope } from '../../ui/loading-scope';
import { RichMarkdownRenderer } from '../../ui/markdown';
import { ReleaseChangelogSection } from '../../ui/release-changelog-section';
import { MediaGalleryStrip } from '../media-gallery-strip';

// Types for injectable components
export interface MarkdownRendererProps {
  content: string;
}

import type { DeliveryResponse } from '../../../types/delivery';
// Canonical RoadmapItem shape lives in chat entity types — see
// `src/components/chat/types/entities/roadmap-item.ts`. The product-release
// detail page previously declared a structural placeholder
// (`{ id; [k: string]: unknown }`) that conflicted with the canonical
// shape once the entities barrel was added; re-exporting the canonical
// type fixes the collision while keeping the same import path for
// downstream consumers of `./release-detail-page`.
import type { RoadmapItem } from '../../chat/types/entities/roadmap-item';
// Re-export both types for source-compat with consumers importing
// through this module. Canonical sources:
//   - RoadmapItem  → `../../chat/types/entities/roadmap-item`
//   - DeliveryResponse → `../../../types/delivery` (single source of
//     truth, shared with the lib `<DeliveryLists>` / `<DeliveryTable>`
//     components and the new types barrel).
export type { RoadmapItem, DeliveryResponse };

/** Wire shape of `${roadmapApiEndpoint}?task_ids=…` — `{ items, count }`. */
interface RoadmapTasksResponse {
  items?: RoadmapItem[];
}

export interface RoadmapSectionProps {
  items: RoadmapItem[];
  isLoading: boolean;
  onItemUpdate?: (item: RoadmapItem) => void;
}

export interface DeliverySectionProps {
  data: DeliveryResponse | null;
  isLoading: boolean;
}

export interface VideoDisplaySectionProps {
  mainVideoUrl?: string | null;
  youtubeUrl?: string | null;
  highlightVideoUrl?: string | null;
  highlightVideoThumbnail?: string | null;
  mainVideoPoster?: string | null;
  title?: string;
  videoSummary?: string | null;
  videoBites?: VideoTeaser[];
  bitesTitle?: string;
  filterPublishedBites?: boolean;
  /** Profile shown in the bites strip's hover overlay (kit sources it from release.author). */
  bitesProfile?: VideoBiteStripProfile | null;
  /** Overlay-footer navigation target (the release the bites originated from). */
  bitesHref?: string;
  captionsUrl?: string | null;
  /** VTT captions URL for the highlight reel (variant=highlight). */
  highlightCaptionsUrl?: string | null;
}

export interface ReleaseDetailPageProps {
  /** Release to fetch. Not needed when `initialData` is supplied. */
  slug?: string;
  /** Pre-fetched release (SSR / RSC / admin preview) — skips the client fetch. */
  initialData?: unknown;
  /**
   * Base GET endpoint for one release; the slug is appended. Default
   * `/api/releases` — the same knob, and the same default, as
   * `<ProductReleasesView>` takes for the list.
   *
   * This page fetches its own release (via `useSelfFetch`, like every other
   * self-fetching content surface here) rather than taking a host-supplied
   * `useRelease` hook, which is what it used to do. A hook passed as a prop is
   * called from inside this component, where nothing — not `rules-of-hooks`,
   * not the compiler, not the host — can guarantee it runs unconditionally,
   * exactly once, per render; and every host was writing the same hook anyway.
   * Nothing about the read was host-specific: `contentFetch` already carries
   * the host's embed auth (registered `EmbedAuthAdapter` → bearer +
   * 401-refresh), so an authed embedder configures a base URL here, not a
   * fetcher.
   */
  endpoint?: string;
  // Injectable components for app-specific rendering
  MarkdownRenderer?: ComponentType<MarkdownRendererProps>;
  RoadmapSection?: ComponentType<RoadmapSectionProps>;
  DeliverySection?: ComponentType<DeliverySectionProps>;
  /** Injectable video display section with tabs for full/highlight video + summary + bites */
  VideoDisplaySection?: ComponentType<VideoDisplaySectionProps>;
  // API endpoints for fetching linked tasks
  roadmapApiEndpoint?: string;
  deliveryApiEndpoint?: string;
  /** Back-button config — same pattern as `DevSectionPage` /
   *  `LegalDocumentPage`. Pass `false` to hide. Default
   *  `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
  /** Link target for the author name in the metadata grid — the host
   *  computes it (public author page; absent ⇒ plain text). */
  authorHref?: string;
  /** Optional slot rendered inside the page chrome, BELOW the article body —
   *  e.g. the hub's end-of-article author byline + related-content / FAQ rail.
   *  Lets the hub mount this page directly (no local wrapper component) while
   *  embedders that don't have those extras simply omit it. */
  relatedContent?: ReactNode;
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container — only the padding box renders,
   *  avoiding a nested `<main>`. */
  shell?: boolean;
}

// Default renderer = the lib's `RichMarkdownRenderer` so out-of-the-box
// release pages get full rich-link previews, embedded media, social cards,
// etc. Hosts that want a different rendering (or a Supabase-aware preset)
// override via the `MarkdownRenderer` prop.
const DefaultMarkdownRenderer = RichMarkdownRenderer;

/** The page's layout, read by the page and by its parts' skeletons, so the loading state is the page's size. */
const CONTENT_STACK_CLASS = 'space-y-6 content-md:space-y-8';
/**
 * A release title's typical lines at the page's `text-h1` (a name, a version and a headline, about 60 characters):
 * five on a phone's 342px, three from `content-md`, two from `content-lg`.
 */
const RELEASE_TITLE_SKELETON_LINES = { phone: 5, md: 3, lg: 2 } as const;
const METADATA_GRID_CLASS =
  'grid w-full grid-cols-1 overflow-hidden rounded-md border border-ods-border content-md:grid-cols-4';
/** A metadata cell's edge (divider + card fill); the cell's own frame is the shared value cell's. */
const METADATA_CELL_EDGE_CLASS = 'border-b border-ods-border bg-ods-card content-md:border-b-0 content-md:border-r';
const SUMMARY_CLASS = 'text-ods-text-primary text-h4';
/**
 * The tags the tag row shows before its "+N" badge, on every width (the case study's and the blog's capped row): a
 * release carries more tags than a phone's line holds (three badges), so the row is capped to that line and drawn the
 * same while it is read: the badges and the "+N" never move the page under them.
 */
const RELEASE_TAG_ROW_FOLD = 3;
/** The metadata grid's value labels (static copy). */
const RELEASE_TYPE_LABEL = 'Release Type';
const RELEASE_STATUS_LABEL = 'Release Status';
const RELEASE_DATE_LABEL = 'Release Date';
/**
 * The release the page renders while it is read: every field empty, so each part draws its own skeleton (a host's
 * empty placeholder, in its loading scope, takes its place).
 */
const EMPTY_RELEASE: Record<string, unknown> = {
  title: '',
  version: '',
  summary: null,
  content: null,
  release_date: '',
  release_type: '',
  release_status: '',
};

/**
 * The release's summary: its own skeleton while the release is read (`useLoadingScope()`), a typical summary of about
 * 350 characters (seven lines on a phone, three on a wide screen); nothing when the release has none.
 */
function ReleaseSummary({ summary }: { summary: string | null }) {
  if (useLoadingScope()) {
    return (
      <div className={SUMMARY_CLASS}>
        <p>
          <TextLineSkeleton type="inherit" as="span" lines={7} className="w-full content-md:hidden" />
          <TextLineSkeleton type="inherit" as="span" lines={3} className="hidden w-full content-md:block" />
        </p>
      </div>
    );
  }
  if (!summary) return null;
  return (
    <div className={SUMMARY_CLASS}>
      <p>{summary}</p>
    </div>
  );
}
/**
 * The delivery tables' collapsed preview (px): about the first rows of a table and the start of the next. The loaded
 * tables and their loading state both sit in a `FadePreview` this high, so the section is one height in both.
 */
const DELIVERY_PREVIEW_HEIGHT = 300;
/** The completed / in-progress table gap inside the preview (the section's own `space-y` stops at the wrapper). */
const DELIVERY_TABLES_STACK_CLASS = 'space-y-4';

/** Single-release route — the hub's public API shape, mirroring `<ProductReleasesView>`. */
const DEFAULT_ENDPOINT = '/api/releases';

export function ReleaseDetailPage({
  authorHref,
  slug,
  initialData,
  endpoint = DEFAULT_ENDPOINT,
  MarkdownRenderer = DefaultMarkdownRenderer,
  RoadmapSection,
  DeliverySection,
  VideoDisplaySection,
  roadmapApiEndpoint = '/api/roadmap',
  deliveryApiEndpoint = '/api/delivery',
  backButton,
  relatedContent,
  shell = true,
}: ReleaseDetailPageProps) {
  const router = useRouter();
  const captions = useCaptions();
  // `shell` true → standalone `<PageShell>`; false → padding-only box (no nested
  // <main>) for hosts whose layout already provides the container.
  const renderShell = (node: ReactNode) =>
    shell ? <PageShell>{node}</PageShell> : <div className="page-shell-content">{node}</div>;
  // The release read. `initialData` (SSR / RSC / admin preview) seeds it and
  // skips the first fetch; a slug-less, seed-less mount fetches nothing and
  // falls through to the not-found state below.
  // A host that passes `null` for "no server data" must not seed the read with
  // it — a seeded read never fetches, and would render not-found forever.
  const seed = initialData == null ? undefined : (initialData as Record<string, unknown>);
  const {
    data: release,
    isLoading,
    error,
  } = useSelfFetch<Record<string, unknown>>(slug ? `${endpoint}/${encodeURIComponent(slug)}` : null, {
    initialData: seed,
  });

  // Back-button config — mirrors DevSectionPage / LegalDocumentPage.
  // Default: { label: 'Back to home', href: '/' }. Pass `false` to hide
  // (e.g. embed-mode where the host owns navigation chrome).
  // Narrowing note: `backButton &&` already eliminates the `false` branch,
  // so the inner expressions are typed as `{ label?, href? } | undefined`.
  // Don't re-compare to `false` here — tsc TS2367s on the dead branch.
  const showBackButton = backButton !== false;
  const backLabel = (backButton ? backButton.label : undefined) ?? 'Back to home';
  const backHref = (backButton ? backButton.href : undefined) ?? '/';

  // Fetch roadmap and delivery tasks if linked to this release
  const [roadmapTasks, setRoadmapTasks] = useState<RoadmapItem[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryResponse | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  // In a loading scope the page is its skeleton and the linked tasks are not fetched.
  const scoped = useLoadingScope();

  useEffect(() => {
    // `release` is a fresh object identity whenever the release read resolves
    // or refetches, so this effect can re-run with two request pairs open at once.
    // Gate every write so a superseded run cannot paint the previous release's
    // roadmap/delivery rows, or drop a loading flag the live run still needs.
    let cancelled = false;

    async function fetchLinkedTasks() {
      if (!release || scoped) return;

      try {
        // Fetch roadmap tasks if linked
        const roadmapTasksData = release.clickup_roadmap_tasks as Array<{ clickup_task_id: string }> | undefined;
        if (roadmapTasksData && roadmapTasksData.length > 0 && RoadmapSection) {
          setRoadmapLoading(true);
          const roadmapIds = roadmapTasksData.map(t => t.clickup_task_id).join(',');
          const roadmapResponse = await contentFetch(`${roadmapApiEndpoint}?task_ids=${roadmapIds}`);
          // A failed request answers with the `{ error, code }` envelope, not
          // with `items` — read it only on 2xx so an outage renders an empty
          // section instead of feeding the error body to the table.
          const roadmapData = roadmapResponse.ok ? ((await roadmapResponse.json()) as RoadmapTasksResponse) : null;
          if (cancelled) return;
          setRoadmapTasks(roadmapData?.items ?? []);
          setRoadmapLoading(false);
        }

        // Fetch delivery tasks if linked
        const deliveryTasksData = release.clickup_delivery_tasks as Array<{ clickup_task_id: string }> | undefined;
        if (deliveryTasksData && deliveryTasksData.length > 0 && DeliverySection) {
          setDeliveryLoading(true);
          const deliveryIds = deliveryTasksData.map(t => t.clickup_task_id).join(',');
          const deliveryResponse = await contentFetch(`${deliveryApiEndpoint}?task_ids=${deliveryIds}`);
          // Same guard as the roadmap fetch — plus both lists are normalized to
          // arrays, because the render reads `.completed.length` unconditionally
          // and an envelope missing either key used to throw during render.
          const deliveryPayload = deliveryResponse.ok
            ? ((await deliveryResponse.json()) as Partial<DeliveryResponse>)
            : null;
          if (cancelled) return;
          setDeliveryData(
            deliveryPayload
              ? { completed: deliveryPayload.completed ?? [], inProgress: deliveryPayload.inProgress ?? [] }
              : null,
          );
          setDeliveryLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching linked tasks:', err);
        setRoadmapLoading(false);
        setDeliveryLoading(false);
      }
    }

    // Never rejects — try/catch, every write gated on `cancelled`.
    void fetchLinkedTasks();

    return () => {
      cancelled = true;
    };
  }, [release, scoped, RoadmapSection, DeliverySection, roadmapApiEndpoint, deliveryApiEndpoint]);

  // `isLoading` is false whenever `initialData` seeded the read, so a
  // pre-fetched (SSR / admin-preview) release never flashes the loading state.
  // In a loading scope the host's record is empty: the scope alone decides.
  const loading = scoped || (isLoading && !release);

  if (!loading && (error || !release)) {
    return renderShell(
      <div className="py-16 text-center">
        <h1 className="mb-4 text-ods-text-primary text-h1">Release Not Found</h1>
        <p className="text-ods-text-secondary text-h4">The release you&apos;re looking for doesn&apos;t exist.</p>
      </div>,
    );
  }
  // While loading: the host's empty placeholder (in its scope) or the page's own empty release.
  const view = release ?? EMPTY_RELEASE;

  const hasBreakingChanges = Array.isArray(view.breaking_changes) && view.breaking_changes.length > 0;

  // Type assertions for release data
  const releaseTitle = view.title as string;
  const releaseVersion = view.version as string;
  const releaseSummary = view.summary as string | null;
  const releaseContent = view.content as string | null;
  const releaseDate = view.release_date as string;
  const releaseType = view.release_type as string;
  const releaseStatus = view.release_status as string;
  const releaseMedia = view.release_media as
    Array<{ id?: string; media_type: string; media_url: string; title?: string }> | undefined;
  // Field-cast per this file's loose-release idiom (release_type etc. above)
  // — but to the SHARED EntityAuthor, never an inline shadow author shape.
  const author = view.author as EntityAuthor | undefined;
  const githubReleases = view.github_releases as Array<{ id: string; github_release_url: string }> | undefined;
  const knowledgeBaseLinks = view.knowledge_base_links as
    Array<{ id?: string; kb_article_path: string }> | string[] | undefined;
  const migrationGuideUrl = view.migration_guide_url as string | undefined;
  const documentationUrl = view.documentation_url as string | undefined;
  const youtubeUrl = view.youtube_url as string | undefined;
  const mainVideoUrl = view.main_video_url as string | undefined;
  const videoBites = view.video_bites as VideoTeaser[] | undefined;
  const highlightVideoUrl = view.highlight_video_url as string | undefined;
  const highlightVideoThumbnail = view.highlight_video_thumbnail as string | undefined;
  // Caption tracks — host-provided values win (the hub's wrapper enriches
  // them); otherwise built HERE from the release's SRT columns, based on
  // `runtime.endpoints.captionsUrlPrefix` (standard runtime-endpoint wiring),
  // so embedders get correctly proxied `<track>` URLs with zero per-host code.
  const entityCaptions = captions.forEntity('product_release', view as unknown as CaptionSrtFields);
  const captionsUrl = (view.captionsUrl as string | undefined) ?? entityCaptions.captionsUrl;
  const highlightCaptionsUrl = (view.highlightCaptionsUrl as string | undefined) ?? entityCaptions.highlightCaptionsUrl;
  const breakingChanges = view.breaking_changes as ChangelogEntry[] | undefined;
  const featuresAdded = view.features_added as ChangelogEntry[] | undefined;
  const bugFixed = view.bugs_fixed as ChangelogEntry[] | undefined;
  const improvements = view.improvements as ChangelogEntry[] | undefined;

  const page = (
    <PageLayout
      title={releaseTitle}
      subtitle={loading ? undefined : `Version: ${releaseVersion}`}
      loading={loading}
      subtitleRow="always"
      titleSize="h1"
      titleWrap
      titleSkeletonLines={RELEASE_TITLE_SKELETON_LINES}
      backButton={showBackButton ? { label: backLabel, onClick: () => router.push(backHref) } : undefined}
    >
      <div className={CONTENT_STACK_CLASS}>
        {/* Tags — flat product_release_tags[] from entity_tags */}
        <EntityTagBadges tags={view.product_release_tags as TagAssoc[] | undefined} max={RELEASE_TAG_ROW_FOLD} />

        {/* Metadata Grid */}
        <div className={METADATA_GRID_CLASS}>
          {/* Release Type, Status and Date: the shared value cell (its own skeleton in a loading scope). */}
          <EntityMetadataValueCell
            value={releaseType}
            label={RELEASE_TYPE_LABEL}
            className={METADATA_CELL_EDGE_CLASS}
          />
          <EntityMetadataValueCell
            value={releaseStatus}
            label={RELEASE_STATUS_LABEL}
            className={METADATA_CELL_EDGE_CLASS}
          />
          <EntityMetadataValueCell
            value={releaseDate ? formatReleaseDate(releaseDate) : ''}
            label={RELEASE_DATE_LABEL}
            className={METADATA_CELL_EDGE_CLASS}
            uppercase={false}
          />

          {/* Author — the shared metadata-grid author cell (it was extracted
              FROM this page; rendering the export instead of an inline copy
              keeps the two in lockstep). The stub author preserves the legacy
              "Unknown Author" rendering for author-less releases; the
              job_title-over-roleLabel rule matches the guide detail page. */}
          <EntityMetadataAuthorCell
            author={author ?? { full_name: null, avatar_url: null }}
            authorHref={author?.full_name ? authorHref : undefined}
          />
        </div>

        {/* Image gallery — shared strip + lightbox (images) / inline clips. A release's media is optional: the loading
            layout leaves the strip out, so the gate leaves it out too. */}
        {releaseMedia && releaseMedia.length > 0 && (
          <div data-loading-optional="">
            <MediaGalleryStrip items={releaseMedia} />
          </div>
        )}

        {/* Summary */}
        <ReleaseSummary summary={releaseSummary} />

        {/* Video Display Section - Injectable or fallback */}
        {/* A release's video is optional: the loading state leaves it out, so the gate leaves it out too. */}
        {/* A block of the page's own stack spacing (its videos keep their gaps), hidden when the slot draws nothing. */}
        {loading ? null : (
          <div data-loading-optional className={`${CONTENT_STACK_CLASS} empty:hidden`}>
            {VideoDisplaySection ? (
              <VideoDisplaySection
                mainVideoUrl={mainVideoUrl}
                youtubeUrl={youtubeUrl}
                highlightVideoUrl={highlightVideoUrl}
                highlightVideoThumbnail={highlightVideoThumbnail}
                title={releaseTitle}
                videoBites={videoBites}
                bitesTitle={DEFAULT_VIDEO_BITES_TITLE}
                filterPublishedBites={true}
                bitesProfile={toStripProfile(author)}
                bitesHref={typeof view.slug === 'string' ? `/releases/${view.slug}` : undefined}
                captionsUrl={captionsUrl}
                highlightCaptionsUrl={highlightCaptionsUrl}
              />
            ) : (
              <>
                {/*
              Fallback when no `VideoDisplaySection` is injected. `<Video>` is the
              SSoT for every video surface — single source of truth across YouTube,
              HLS, and MP4 paths.
            */}
                {youtubeUrl && (
                  <Video kind="youtube" url={youtubeUrl} title={`${releaseTitle} - Video`} layout="native" />
                )}
                {!youtubeUrl && mainVideoUrl && (
                  <Video url={mainVideoUrl} captionsUrl={captionsUrl} layout="centered" />
                )}
                {highlightVideoUrl && (
                  <Video
                    url={highlightVideoUrl}
                    poster={highlightVideoThumbnail}
                    captionsUrl={highlightCaptionsUrl}
                    layout="centered"
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Content */}
        {/* Record-dependent blocks the loading state does not draw carry `data-loading-optional`. */}
        {releaseContent && (
          <div className="text-ods-text-primary text-h4" data-loading-optional>
            <MarkdownRenderer content={releaseContent} />
          </div>
        )}

        {/* Breaking Changes Warning */}
        {hasBreakingChanges && (
          <Card className="border-ods-error bg-ods-error/10" data-loading-optional>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-ods-error" />
                <div>
                  <h3 className="text-ods-error text-h3">Breaking Changes</h3>
                  <p className="text-ods-text-secondary">
                    This release contains breaking changes. Review carefully before upgrading.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Changelog Sections — icons match the catalog card's changelog
            strip taxonomy (Sparkles/Wrench/TrendingUp/AlertTriangle) so the
            user sees a consistent visual signature across catalog → detail. */}
        {/* Breaking changes are optional per release: the loading state leaves them out (`loadingOptional`). */}
        {loading ? null : (
          <ReleaseChangelogSection
            title="Breaking Changes"
            entries={breakingChanges || []}
            isBreaking
            hideTitle
            loadingOptional
            icon={<AlertTriangle className="h-6 w-6" />}
            MarkdownRenderer={MarkdownRenderer}
          />
        )}
        {/* Features / Bugs / Improvements use `previewFirst` — same
            progressive-disclosure pattern as the investor-update detail
            page's Key Highlights / Financial Notes sections. Shows the
            first entry in full + fade-masks the rest, with a "Show N
            more / Show less" toggle. Breaking Changes (above) stays
            fully expanded — it's critical info, not skim-friendly. */}
        <ReleaseChangelogSection
          title="Features Added"
          entries={featuresAdded || []}
          icon={<Sparkles className="h-6 w-6" />}
          previewFirst
          MarkdownRenderer={MarkdownRenderer}
        />
        <ReleaseChangelogSection
          title="Bugs Fixed"
          entries={bugFixed || []}
          icon={<Wrench className="h-6 w-6" />}
          previewFirst
          MarkdownRenderer={MarkdownRenderer}
        />
        <ReleaseChangelogSection
          title="Improvements"
          entries={improvements || []}
          icon={<TrendingUp className="h-6 w-6" />}
          previewFirst
          MarkdownRenderer={MarkdownRenderer}
        />

        {/* Related Roadmap Items */}
        {RoadmapSection && (roadmapLoading || roadmapTasks.length > 0) && (
          <div className="w-full space-y-4" data-loading-optional>
            <p className="tracking-[-0.28px] text-ods-text-secondary text-h5">Related Roadmap Items</p>
            <RoadmapSection
              items={roadmapTasks}
              isLoading={roadmapLoading}
              onItemUpdate={updatedItem => {
                setRoadmapTasks(prevTasks => prevTasks.map(task => (task.id === updatedItem.id ? updatedItem : task)));
              }}
            />
          </div>
        )}

        {/* Bug-fixes & Enhancements Section — releases can link dozens of
            delivery tasks, so the list gets the same `FadePreview`
            progressive disclosure as the changelog sections above: first
            row visible, rest fade-masked behind "Show N more". */}
        {DeliverySection &&
          (deliveryLoading ||
            (deliveryData && (deliveryData.completed.length > 0 || deliveryData.inProgress.length > 0))) && (
            <div className="w-full space-y-4" data-loading-optional>
              <p className="tracking-[-0.28px] text-ods-text-secondary text-h5">Related Enhancements and Bug-fixes</p>
              {(() => {
                const deliveryCount = deliveryData ? deliveryData.completed.length + deliveryData.inProgress.length : 0;
                return deliveryLoading ? (
                  // The loaded preview's frame, its height written into the markup (`fixedHeight`), so the tables'
                  // loading state takes the collapsed preview's place, toggle row included. Inert: nothing to open yet.
                  <div inert>
                    <FadePreview fixedHeight collapsedHeight={DELIVERY_PREVIEW_HEIGHT}>
                      <div className={DELIVERY_TABLES_STACK_CLASS}>
                        <DeliverySection data={deliveryData} isLoading={deliveryLoading} />
                      </div>
                    </FadePreview>
                  </div>
                ) : (
                  <FadePreview
                    hiddenCount={deliveryCount - 1}
                    collapsedHeight={DELIVERY_PREVIEW_HEIGHT}
                    resetKey={deliveryCount}
                  >
                    <div className={DELIVERY_TABLES_STACK_CLASS}>
                      <DeliverySection data={deliveryData} isLoading={false} />
                    </div>
                  </FadePreview>
                );
              })()}
            </div>
          )}

        {/* Related Links */}
        {(githubReleases?.length || knowledgeBaseLinks?.length || migrationGuideUrl || documentationUrl) && (
          <div className="w-full space-y-1" data-loading-optional>
            <p className="tracking-[-0.28px] text-ods-text-secondary text-h5">Related Links</p>
            <Card className="border-ods-border bg-ods-card p-6">
              <div className="space-y-4">
                {/* GitHub Releases */}
                {githubReleases && githubReleases.length > 0 && (
                  <>
                    {githubReleases.map(ghRelease => (
                      <div key={ghRelease.id} className="flex items-start gap-1">
                        <GithubClassicIcon className="shrink-0" size={24} color="var(--color-text-secondary)" />
                        <span className="text-ods-text-primary text-h4">Github Release</span>
                        <Link
                          href={ghRelease.github_release_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ods-accent text-h4 hover:underline"
                        >
                          {ghRelease.github_release_url.split('/').pop()}
                        </Link>
                        <ExternalLink className="h-6 w-6 shrink-0 text-ods-accent" />
                      </div>
                    ))}
                  </>
                )}

                {/* Knowledge Base Links */}
                {knowledgeBaseLinks && knowledgeBaseLinks.length > 0 && (
                  <>
                    {knowledgeBaseLinks.map(linkObj => {
                      const path = typeof linkObj === 'string' ? linkObj : linkObj.kb_article_path;
                      const linkId = typeof linkObj === 'string' ? path : linkObj.id || path;
                      return (
                        <div key={linkId} className="flex items-start gap-1">
                          <BookMarked className="h-6 w-6 shrink-0 text-ods-text-secondary" />
                          <span className="text-ods-text-primary text-h4">Knowledge Base</span>
                          <Link
                            href={
                              path.startsWith('http')
                                ? path
                                : `/knowledge-base${path.startsWith('/') ? '' : '/'}${path}`
                            }
                            className="text-ods-accent text-h4 hover:underline"
                          >
                            {path.replace(/^\//, '').split('/').pop()?.replace(/-/g, ' ') || 'View Article'}
                          </Link>
                          <ExternalLink className="h-6 w-6 shrink-0 text-ods-accent" />
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Migration Guide */}
                {migrationGuideUrl && (
                  <div className="flex items-start gap-1">
                    <BookMarked className="h-6 w-6 shrink-0 text-ods-text-secondary" />
                    <Link
                      href={migrationGuideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ods-accent text-h4 hover:underline"
                    >
                      📖 Migration Guide
                    </Link>
                    <ExternalLink className="h-6 w-6 shrink-0 text-ods-accent" />
                  </div>
                )}

                {/* Documentation */}
                {documentationUrl && (
                  <div className="flex items-start gap-1">
                    <BookMarked className="h-6 w-6 shrink-0 text-ods-text-secondary" />
                    <Link
                      href={documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ods-accent text-h4 hover:underline"
                    >
                      📚 Documentation
                    </Link>
                    <ExternalLink className="h-6 w-6 shrink-0 text-ods-accent" />
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/*
       * Host slot — end-of-article byline + related-content / FAQ rail.
       *
       * KEYED for the same reason as `onboarding-guide-detail-view.tsx`: this is a
       * member of PageLayout's static children array, and a slot element built in a
       * SERVER component crosses the RSC boundary as a lazy chunk wrapper, so
       * `validateChildKeys` marks the wrapper and the fulfilled path never copies
       * `_store.validated` onto the revived element — it reaches the reconciler
       * unvalidated and warns.
       *
       * Today the hub's only consumer of this view is a `'use client'` wrapper that
       * builds the slot locally, so no element actually crosses the boundary and
       * this is pre-emptive. It is kept because the trap is invisible from here: a
       * future server-built slot would warn with no clue pointing at this line.
       * A keyed Fragment emits no DOM, so output is byte-identical either way.
       */}
      <Fragment key="related-content">{relatedContent}</Fragment>
    </PageLayout>
  );
  // The loading state is the page itself in a scope, announced once unless a host's scope already did.
  return renderShell(
    loading ? (
      <LoadingRegion label="Loading the release" announce={!scoped}>
        <LoadingScope>{page}</LoadingScope>
      </LoadingRegion>
    ) : (
      page
    ),
  );
}
