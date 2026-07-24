"use client";

import { useState, useEffect, Fragment, ComponentType, type ReactNode } from 'react';
import Link from '../../../embed-shims/next-link';
import { useRouter } from '../../../embed-shims/next-navigation';
import { Card, CardContent } from '../../ui/card';
// PageShell (wide) — match the related-content/FAQ rail container the hub
// renders below this view (was ArticleDetailLayout, 1280px — narrower than
// the rail, see hub detail-container alignment decision 2026-06-10).
import { PageShell } from '../../layout/article-detail-layout';
import { PageLayout } from '../../layout/page-layout';
import { FadePreview } from '../../ui/fade-preview';
import { ReleaseChangelogSection } from '../../ui/release-changelog-section';
import { RichMarkdownRenderer } from '../../ui/markdown';
import { EntityTagBadges } from '../../features/entity-tag-badges';
import { EntityMetadataAuthorCell } from '../../chat/entity-cards/entity-author-card';
import type { EntityAuthor } from '../../../types/entity-author';
import { MediaGalleryStrip } from '../media-gallery-strip';
import { GitHubIcon } from '../../icons/github-icon';
import { AlertTriangle, ExternalLink, BookMarked, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import { formatReleaseDate } from '../../../utils/date-formatters';
import { contentFetch } from '../../../utils/embed-content-fetch';
import { Video } from '../../features/video';
import { DetailPageSkeleton } from '../detail-page-skeleton';
import type { ChangelogEntry } from '../../../types/product-release';
import type { TagAssoc } from '../../../types/blog';
import type { VideoTeaser } from '../../../types/video-processing';
import {
  DEFAULT_VIDEO_BITES_TITLE,
  toStripProfile,
  type VideoBiteStripProfile,
} from '../../features/video-bites-shared';

// Types for injectable components
export interface MarkdownRendererProps {
  content: string;
}

// Canonical RoadmapItem shape lives in chat entity types — see
// `src/components/chat/types/entities/roadmap-item.ts`. The product-release
// detail page previously declared a structural placeholder
// (`{ id; [k: string]: unknown }`) that conflicted with the canonical
// shape once the entities barrel was added; re-exporting the canonical
// type fixes the collision while keeping the same import path for
// downstream consumers of `./release-detail-page`.
import type { RoadmapItem } from '../../chat/types/entities/roadmap-item';
import type { DeliveryResponse } from '../../../types/delivery';
// Re-export both types for source-compat with consumers importing
// through this module. Canonical sources:
//   - RoadmapItem  → `../../chat/types/entities/roadmap-item`
//   - DeliveryResponse → `../../../types/delivery` (single source of
//     truth, shared with the lib `<DeliveryLists>` / `<DeliveryTable>`
//     components and the new types barrel).
export type { RoadmapItem, DeliveryResponse };

export interface RoadmapSectionProps {
  items: RoadmapItem[];
  isLoading: boolean;
  onItemUpdate?: (item: RoadmapItem) => void;
}

export interface DeliverySectionProps {
  data: DeliveryResponse | null;
  isLoading: boolean;
}

// Type for the useRelease hook result
export interface UseReleaseResult {
  data: unknown;
  error: Error | null;
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
  srtContent?: string | null;
  captionsUrl?: string | null;
}

export interface ReleaseDetailPageProps {
  slug: string;
  initialData?: unknown; // Optional pre-fetched data for admin preview
  // Required: Hook for fetching release data (must be from app-level to use correct QueryClient)
  useRelease: (slug: string | undefined) => UseReleaseResult;
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

export function ReleaseDetailPage({
  authorHref,
  slug,
  initialData,
  useRelease,
  MarkdownRenderer = DefaultMarkdownRenderer,
  RoadmapSection,
  DeliverySection,
  VideoDisplaySection,
  roadmapApiEndpoint = '/api/roadmap',
  deliveryApiEndpoint = '/api/delivery',
  backButton,
  relatedContent,
  shell = true
}: ReleaseDetailPageProps) {
  const router = useRouter();
  // `shell` true → standalone `<PageShell>`; false → padding-only box (no nested
  // <main>) for hosts whose layout already provides the container.
  const renderShell = (node: ReactNode) =>
    shell ? <PageShell>{node}</PageShell> : <div className="page-shell-content">{node}</div>;
  // Use pre-fetched data if provided (admin preview), otherwise fetch via hook (public)
  const { data: fetchedRelease, error, isLoading } = useRelease(initialData ? undefined : slug);
  const release = (initialData || fetchedRelease) as Record<string, unknown> | undefined;

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

  useEffect(() => {
    async function fetchLinkedTasks() {
      if (!release) return;

      try {
        // Fetch roadmap tasks if linked
        const roadmapTasksData = release.clickup_roadmap_tasks as Array<{ clickup_task_id: string }> | undefined;
        if (roadmapTasksData && roadmapTasksData.length > 0 && RoadmapSection) {
          setRoadmapLoading(true);
          const roadmapIds = roadmapTasksData.map(t => t.clickup_task_id).join(',');
          const roadmapResponse = await contentFetch(`${roadmapApiEndpoint}?task_ids=${roadmapIds}`);
          const roadmapData = await roadmapResponse.json();
          setRoadmapTasks(roadmapData.items || []);
          setRoadmapLoading(false);
        }

        // Fetch delivery tasks if linked
        const deliveryTasksData = release.clickup_delivery_tasks as Array<{ clickup_task_id: string }> | undefined;
        if (deliveryTasksData && deliveryTasksData.length > 0 && DeliverySection) {
          setDeliveryLoading(true);
          const deliveryIds = deliveryTasksData.map(t => t.clickup_task_id).join(',');
          const deliveryResponse = await contentFetch(`${deliveryApiEndpoint}?task_ids=${deliveryIds}`);
          const deliveryResponseData = await deliveryResponse.json();
          setDeliveryData(deliveryResponseData);
          setDeliveryLoading(false);
        }
      } catch (err) {
        console.error('Error fetching linked tasks:', err);
        setRoadmapLoading(false);
        setDeliveryLoading(false);
      }
    }

    fetchLinkedTasks();
  }, [release, RoadmapSection, DeliverySection, roadmapApiEndpoint, deliveryApiEndpoint]);

  // Don't show loading skeleton if we have initialData
  if (!initialData && isLoading) {
    // `bare` + `PageShell` so the loading state matches the loaded page's full
    // width / padding / min-height (the wrapper supplies the page chrome).
    return renderShell(
      // Match the loaded page's top offset (TitleBlock's
      // `pt-[var(--spacing-system-l)]`) so content doesn't jump on load.
      <div className="pt-[var(--spacing-system-l)]">
        <DetailPageSkeleton bare metadataColumns={4} showImageGallery={true} />
      </div>
    );
  }

  if (error || !release) {
    return renderShell(
      <div className="text-center py-16">
        <h1 className="text-h1 text-ods-text-primary mb-4">Release Not Found</h1>
        <p className="text-h4 text-ods-text-secondary">The release you&apos;re looking for doesn&apos;t exist.</p>
      </div>
    );
  }

  const hasBreakingChanges = Array.isArray(release.breaking_changes) && release.breaking_changes.length > 0;

  // Type assertions for release data
  const releaseTitle = release.title as string;
  const releaseVersion = release.version as string;
  const releaseSummary = release.summary as string | null;
  const releaseContent = release.content as string | null;
  const releaseDate = release.release_date as string;
  const releaseType = release.release_type as string;
  const releaseStatus = release.release_status as string;
  const releaseMedia = release.release_media as Array<{ id?: string; media_type: string; media_url: string; title?: string }> | undefined;
  // Field-cast per this file's loose-release idiom (release_type etc. above)
  // — but to the SHARED EntityAuthor, never an inline shadow author shape.
  const author = release.author as EntityAuthor | undefined;
  const githubReleases = release.github_releases as Array<{ id: string; github_release_url: string }> | undefined;
  const knowledgeBaseLinks = release.knowledge_base_links as Array<{ id?: string; kb_article_path: string }> | string[] | undefined;
  const migrationGuideUrl = release.migration_guide_url as string | undefined;
  const documentationUrl = release.documentation_url as string | undefined;
  const youtubeUrl = release.youtube_url as string | undefined;
  const mainVideoUrl = release.main_video_url as string | undefined;
  const videoBites = release.video_bites as VideoTeaser[] | undefined;
  const highlightVideoUrl = release.highlight_video_url as string | undefined;
  const highlightVideoThumbnail = release.highlight_video_thumbnail as string | undefined;
  const breakingChanges = release.breaking_changes as ChangelogEntry[] | undefined;
  const featuresAdded = release.features_added as ChangelogEntry[] | undefined;
  const bugFixed = release.bugs_fixed as ChangelogEntry[] | undefined;
  const improvements = release.improvements as ChangelogEntry[] | undefined;

  return renderShell(
    <PageLayout
        title={releaseTitle}
        subtitle={`Version: ${releaseVersion}`}
        titleSize="h1"
        titleWrap
        backButton={
          showBackButton ? { label: backLabel, onClick: () => router.push(backHref) } : undefined
        }
      >
      <div className="space-y-6 md:space-y-8">
        {/* Tags — flat product_release_tags[] from entity_tags */}
        <EntityTagBadges tags={release.product_release_tags as TagAssoc[] | undefined} />

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 border border-ods-border rounded-md overflow-hidden w-full">
          {/* Release Type */}
          <div className="bg-ods-card border-b md:border-b-0 md:border-r border-ods-border p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-0">
              <p className="text-h4 text-ods-text-primary">
                {releaseType.toLocaleUpperCase()}
              </p>
              <p className="text-h6 text-ods-text-secondary">
                Release Type
              </p>
            </div>
          </div>

          {/* Release Status */}
          <div className="bg-ods-card border-b md:border-b-0 md:border-r border-ods-border p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-0">
              <p className="text-h4 text-ods-text-primary">
                {releaseStatus.toLocaleUpperCase()}
              </p>
              <p className="text-h6 text-ods-text-secondary">
                Release Status
              </p>
            </div>
          </div>

          {/* Release Date */}
          <div className="bg-ods-card border-b md:border-b-0 md:border-r border-ods-border p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-0">
              <p className="text-h4 text-ods-text-primary">
                {formatReleaseDate(releaseDate)}
              </p>
              <p className="text-h6 text-ods-text-secondary">
                Release Date
              </p>
            </div>
          </div>

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

        {/* Image gallery — shared strip + lightbox (images) / inline clips. */}
        <MediaGalleryStrip items={releaseMedia ?? []} />

        {/* Summary */}
        {releaseSummary && (
          <div className="text-h4 text-ods-text-primary">
            <p>{releaseSummary}</p>
          </div>
        )}

        {/* Video Display Section - Injectable or fallback */}
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
            bitesHref={typeof release.slug === 'string' ? `/releases/${release.slug}` : undefined}
            srtContent={release?.srt_content as string | null | undefined}
            captionsUrl={release?.captionsUrl as string | undefined}
          />
        ) : (
          <>
            {/*
              Fallback when no `VideoDisplaySection` is injected. `<Video>` is the
              SSoT for every video surface — single source of truth across YouTube,
              HLS, and MP4 paths.
            */}
            {youtubeUrl && (
              <Video
                kind="youtube"
                url={youtubeUrl}
                title={`${releaseTitle} - Video`}
                layout="native"
              />
            )}
            {!youtubeUrl && mainVideoUrl && (
              <Video
                url={mainVideoUrl}
                srtContent={release?.srt_content as string | undefined}
                captionsUrl={release?.captionsUrl as string | undefined}
                layout="centered"
              />
            )}
            {highlightVideoUrl && (
              <Video
                url={highlightVideoUrl}
                poster={highlightVideoThumbnail}
                layout="centered"
              />
            )}
          </>
        )}

        {/* Content */}
        {releaseContent && (
          <div className="text-h4 text-ods-text-primary">
            <MarkdownRenderer content={releaseContent} />
          </div>
        )}

        {/* Breaking Changes Warning */}
        {hasBreakingChanges && (
          <Card className="border-ods-error bg-ods-error/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-ods-error" />
                <div>
                  <h3 className="text-h3 text-ods-error">Breaking Changes</h3>
                  <p className="text-ods-text-secondary">This release contains breaking changes. Review carefully before upgrading.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Changelog Sections — icons match the catalog card's changelog
            strip taxonomy (Sparkles/Wrench/TrendingUp/AlertTriangle) so the
            user sees a consistent visual signature across catalog → detail. */}
        <ReleaseChangelogSection
          title="Breaking Changes"
          entries={breakingChanges || []}
          isBreaking
          hideTitle
          icon={<AlertTriangle className="h-6 w-6" />}
          MarkdownRenderer={MarkdownRenderer}
        />
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
          <div className="space-y-4 w-full">
            <p className="text-h5 tracking-[-0.28px] text-ods-text-secondary">
              Related Roadmap Items
            </p>
            <RoadmapSection
              items={roadmapTasks}
              isLoading={roadmapLoading}
              onItemUpdate={(updatedItem) => {
                setRoadmapTasks(prevTasks =>
                  prevTasks.map(task =>
                    task.id === updatedItem.id ? updatedItem : task
                  )
                );
              }}
            />
          </div>
        )}

        {/* Bug-fixes & Enhancements Section — releases can link dozens of
            delivery tasks, so the list gets the same `FadePreview`
            progressive disclosure as the changelog sections above: first
            row visible, rest fade-masked behind "Show N more". */}
        {DeliverySection && (deliveryLoading || (deliveryData && (deliveryData.completed.length > 0 || deliveryData.inProgress.length > 0))) && (
          <div className="w-full space-y-4">
            <p className="text-h5 tracking-[-0.28px] text-ods-text-secondary">
              Related Enhancements and Bug-fixes
            </p>
            {(() => {
              const deliveryCount = deliveryData
                ? deliveryData.completed.length + deliveryData.inProgress.length
                : 0;
              return deliveryLoading ? (
                <DeliverySection data={deliveryData} isLoading={deliveryLoading} />
              ) : (
                <FadePreview
                  hiddenCount={deliveryCount - 1}
                  collapsedHeight={300}
                  resetKey={deliveryCount}
                >
                  {/* space-y-4 restores the completed/in-progress table gap the
                      parent's space-y used to provide before the fade wrapper. */}
                  <div className="space-y-4">
                    <DeliverySection data={deliveryData} isLoading={false} />
                  </div>
                </FadePreview>
              );
            })()}
          </div>
        )}

        {/* Related Links */}
        {(githubReleases?.length || knowledgeBaseLinks?.length || migrationGuideUrl || documentationUrl) && (
          <div className="space-y-1 w-full">
            <p className="text-h5 tracking-[-0.28px] text-ods-text-secondary">
              Related Links
            </p>
            <Card className="bg-ods-card border-ods-border p-6">
              <div className="space-y-4">
                {/* GitHub Releases */}
                {githubReleases && githubReleases.length > 0 && (
                  <>
                    {githubReleases.map((ghRelease) => (
                      <div key={ghRelease.id} className="flex items-start gap-1">
                        <GitHubIcon className="shrink-0" width={24} height={24} color="var(--color-text-secondary)" />
                        <span className="text-h4 text-ods-text-primary">
                          Github Release
                        </span>
                        <a
                          href={ghRelease.github_release_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-h4 text-ods-accent hover:underline"
                        >
                          {ghRelease.github_release_url.split('/').pop()}
                        </a>
                        <ExternalLink className="h-6 w-6 text-ods-accent shrink-0" />
                      </div>
                    ))}
                  </>
                )}

                {/* Knowledge Base Links */}
                {knowledgeBaseLinks && knowledgeBaseLinks.length > 0 && (
                  <>
                    {knowledgeBaseLinks.map((linkObj) => {
                      const path = typeof linkObj === 'string' ? linkObj : linkObj.kb_article_path;
                      const linkId = typeof linkObj === 'string' ? path : linkObj.id || path;
                      return (
                        <div key={linkId} className="flex items-start gap-1">
                          <BookMarked className="h-6 w-6 text-ods-text-secondary shrink-0" />
                          <span className="text-h4 text-ods-text-primary">
                            Knowledge Base
                          </span>
                          <Link
                            href={path.startsWith('http') ? path : `/knowledge-base${path.startsWith('/') ? '' : '/'}${path}`}
                            className="text-h4 text-ods-accent hover:underline"
                          >
                            {path.replace(/^\//, '').split('/').pop()?.replace(/-/g, ' ') || 'View Article'}
                          </Link>
                          <ExternalLink className="h-6 w-6 text-ods-accent shrink-0" />
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Migration Guide */}
                {migrationGuideUrl && (
                  <div className="flex items-start gap-1">
                    <BookMarked className="h-6 w-6 text-ods-text-secondary shrink-0" />
                    <a
                      href={migrationGuideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-h4 text-ods-accent hover:underline"
                    >
                      📖 Migration Guide
                    </a>
                    <ExternalLink className="h-6 w-6 text-ods-accent shrink-0" />
                  </div>
                )}

                {/* Documentation */}
                {documentationUrl && (
                  <div className="flex items-start gap-1">
                    <BookMarked className="h-6 w-6 text-ods-text-secondary shrink-0" />
                    <a
                      href={documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-h4 text-ods-accent hover:underline"
                    >
                      📚 Documentation
                    </a>
                    <ExternalLink className="h-6 w-6 text-ods-accent shrink-0" />
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
}
