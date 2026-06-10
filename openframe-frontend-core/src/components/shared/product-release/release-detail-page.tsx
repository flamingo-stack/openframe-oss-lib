"use client";

import { useState, useEffect, ComponentType } from 'react';
import Link from '../../../embed-shims/next-link';
import { useRouter } from '../../../embed-shims/next-navigation';
import { Card, CardContent } from '../../ui/card';
// PageShell (wide) — match the related-content/FAQ rail container the hub
// renders below this view (was ArticleDetailLayout, 1280px — narrower than
// the rail, see hub detail-container alignment decision 2026-06-10).
import { PageShell } from '../../layout/article-detail-layout';
import { BackButton } from '../../layout/back-button';
import { ReleaseChangelogSection } from '../../ui/release-changelog-section';
import { EntityTagBadges } from '../../features/entity-tag-badges';
import { SquareAvatar } from '../../ui/square-avatar';
import { ImageGalleryModal } from '../../ui/image-gallery-modal';
import { GitHubIcon } from '../../icons/github-icon';
import { AlertTriangle, ExternalLink, BookMarked, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import { formatReleaseDate } from '../../../utils/date-formatters';
import { nameInitials } from '../../../utils/format';
import { Video } from '../../features/video';
import { DetailPageSkeleton } from '../detail-page-skeleton';
import type { ChangelogEntry } from '../../../types/product-release';
import type { TagAssoc } from '../../../types/blog';
import type { VideoTeaser } from '../../../types/video-processing';

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

export interface VideoSectionProps {
  bites: VideoTeaser[];
  title?: string;
  filterPublished?: boolean;
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
  VideoSection?: ComponentType<VideoSectionProps>;
  /** Injectable video display section with tabs for full/highlight video + summary + bites */
  VideoDisplaySection?: ComponentType<VideoDisplaySectionProps>;
  // API endpoints for fetching linked tasks
  roadmapApiEndpoint?: string;
  deliveryApiEndpoint?: string;
  /** Back-button config — same pattern as `DevSectionPage` /
   *  `LegalDocumentPage`. Pass `false` to hide. Default
   *  `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
}

// Default simple markdown renderer (just renders as text)
function DefaultMarkdownRenderer({ content }: MarkdownRendererProps) {
  return <div className="whitespace-pre-wrap">{content}</div>;
}

export function ReleaseDetailPage({
  slug,
  initialData,
  useRelease,
  MarkdownRenderer = DefaultMarkdownRenderer,
  RoadmapSection,
  DeliverySection,
  VideoSection,
  VideoDisplaySection,
  roadmapApiEndpoint = '/api/roadmap',
  deliveryApiEndpoint = '/api/delivery',
  backButton
}: ReleaseDetailPageProps) {
  const router = useRouter();
  // Use pre-fetched data if provided (admin preview), otherwise fetch via hook (public)
  const { data: fetchedRelease, error, isLoading } = useRelease(initialData ? undefined : slug);
  const release = (initialData || fetchedRelease) as Record<string, unknown> | undefined;
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

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
          const roadmapResponse = await fetch(`${roadmapApiEndpoint}?task_ids=${roadmapIds}`);
          const roadmapData = await roadmapResponse.json();
          setRoadmapTasks(roadmapData.items || []);
          setRoadmapLoading(false);
        }

        // Fetch delivery tasks if linked
        const deliveryTasksData = release.clickup_delivery_tasks as Array<{ clickup_task_id: string }> | undefined;
        if (deliveryTasksData && deliveryTasksData.length > 0 && DeliverySection) {
          setDeliveryLoading(true);
          const deliveryIds = deliveryTasksData.map(t => t.clickup_task_id).join(',');
          const deliveryResponse = await fetch(`${deliveryApiEndpoint}?task_ids=${deliveryIds}`);
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
    return <DetailPageSkeleton metadataColumns={4} showImageGallery={true} />;
  }

  if (error || !release) {
    return (
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold text-ods-text-primary mb-4">Release Not Found</h1>
        <p className="text-xl text-ods-text-secondary">The release you&apos;re looking for doesn&apos;t exist.</p>
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
  const author = release.author as { avatar_url?: string; full_name?: string } | undefined;
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

  return (
    <PageShell>
      {/* Back button — desktop-only, matches DevSectionPage / LegalDocumentPage
          (TitleBlock renders the same `hidden md:inline-flex` BackButton). */}
      {showBackButton && (
        <BackButton
          label={backLabel}
          onClick={() => router.push(backHref)}
          className="hidden md:inline-flex mb-4"
        />
      )}
      <div className="space-y-6 md:space-y-8">
        {/* Title Block */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 w-full">
          <div className="flex-1 flex flex-col gap-2">
            {/* Title */}
            <h1 className="text-h1 tracking-[-1.12px] text-ods-text-primary">
              {releaseTitle}
            </h1>

            {/* Version */}
            <p className="text-h4 text-ods-text-secondary">
              Version: {releaseVersion}
            </p>
          </div>
        </div>

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
              <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
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
              <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
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
              <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
                Release Date
              </p>
            </div>
          </div>

          {/* Author */}
          <div className="bg-ods-card p-4 flex items-center gap-3">
            <SquareAvatar
              src={author?.avatar_url || ''}
              alt={author?.full_name || 'Author'}
              fallback={nameInitials(author?.full_name || 'Unknown', '')}
              size="md"
              variant="round"
            />
            <div className="flex flex-col gap-0 flex-1 min-w-0">
              <p className="text-h3 tracking-[-0.36px] text-ods-text-primary truncate" title={author?.full_name || 'Unknown Author'}>
                {author?.full_name || 'Unknown Author'}
              </p>
              <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
                Author
              </p>
            </div>
          </div>
        </div>

        {/* Image Gallery - Horizontal Scrolling */}
        {releaseMedia && releaseMedia.length > 0 && (
          <div className="flex gap-6 overflow-x-auto w-full">
            {releaseMedia.slice(0, 5).map((mediaItem, index) => (
              <div
                key={mediaItem.id || index}
                className="shrink-0 w-[240px] h-[200px] rounded-md overflow-hidden border border-ods-border bg-black cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  if (mediaItem.media_type !== 'video' && mediaItem.media_type !== 'demo') {
                    setGalleryIndex(index);
                    setGalleryOpen(true);
                  }
                }}
              >
                {mediaItem.media_type === 'video' || mediaItem.media_type === 'demo' ? (
                  <Video url={mediaItem.media_url} layout="native" />
                ) : (
                  <img src={mediaItem.media_url} alt={mediaItem.title || `Media ${index + 1}`} className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

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
            bitesTitle="Video Clips"
            filterPublishedBites={true}
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
          <Card className="border-red-500 bg-red-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="font-bold text-red-500 text-lg">Breaking Changes</h3>
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
          SimpleMarkdownRenderer={MarkdownRenderer}
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
          SimpleMarkdownRenderer={MarkdownRenderer}
        />
        <ReleaseChangelogSection
          title="Bugs Fixed"
          entries={bugFixed || []}
          icon={<Wrench className="h-6 w-6" />}
          previewFirst
          SimpleMarkdownRenderer={MarkdownRenderer}
        />
        <ReleaseChangelogSection
          title="Improvements"
          entries={improvements || []}
          icon={<TrendingUp className="h-6 w-6" />}
          previewFirst
          SimpleMarkdownRenderer={MarkdownRenderer}
        />

        {/* Video Bites Section - Only when VideoDisplaySection is not handling it */}
        {!VideoDisplaySection && VideoSection && videoBites && videoBites.length > 0 && (
          <VideoSection
            bites={videoBites}
            title="Video Clips"
            filterPublished={true}
          />
        )}

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

        {/* Bug-fixes & Enhancements Section */}
        {DeliverySection && (deliveryLoading || (deliveryData && (deliveryData.completed.length > 0 || deliveryData.inProgress.length > 0))) && (
          <div className="w-full space-y-4">
            <p className="text-h5 tracking-[-0.28px] text-ods-text-secondary">
              Related Enhancements and Bug-fixes
            </p>
            <DeliverySection
              data={deliveryData}
              isLoading={deliveryLoading}
            />
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
                          className="text-h4 text-[#ffc008] hover:underline"
                        >
                          {ghRelease.github_release_url.split('/').pop()}
                        </a>
                        <ExternalLink className="h-6 w-6 text-[#ffc008] shrink-0" />
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
                            className="text-h4 text-[#ffc008] hover:underline"
                          >
                            {path.replace(/^\//, '').split('/').pop()?.replace(/-/g, ' ') || 'View Article'}
                          </Link>
                          <ExternalLink className="h-6 w-6 text-[#ffc008] shrink-0" />
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
                      className="text-h4 text-[#ffc008] hover:underline"
                    >
                      📖 Migration Guide
                    </a>
                    <ExternalLink className="h-6 w-6 text-[#ffc008] shrink-0" />
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
                      className="text-h4 text-[#ffc008] hover:underline"
                    >
                      📚 Documentation
                    </a>
                    <ExternalLink className="h-6 w-6 text-[#ffc008] shrink-0" />
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Gallery Modal */}
      {releaseMedia && releaseMedia.filter((m) => m.media_type !== 'video' && m.media_type !== 'demo').length > 0 && (
        <ImageGalleryModal
          images={releaseMedia.filter((m) => m.media_type !== 'video' && m.media_type !== 'demo').map((m) => m.media_url)}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          initialIndex={galleryIndex}
        />
      )}
    </PageShell>
  );
}
