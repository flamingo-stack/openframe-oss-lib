'use client';

import type React from 'react';
import type { ComponentType } from 'react';
import type { VideoTeaser } from '../../types/video-processing';
import { cn } from '../../utils/cn';
import { SECTION_HEADING_CLASS } from '../layout/page-heading';
import { useLoadingScope } from '../ui/loading-scope';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { useCaptions } from './use-captions';
import { Video, VideoSkeleton } from './video';
import { DEFAULT_VIDEO_BITES_TITLE, type VideoBiteStripProfile } from './video-bites-shared';
import { VideoBitesStrip, type VideoBiteStripItem } from './video-bites-strip';

/**
 * <EntityVideoSection> — public detail-page video block.
 *
 * Tabbed Full Video / Highlights when both exist, plus optional
 * markdown summary + video bites grid. The actual video rendering
 * (YouTube facade, Mux HLS, MP4 fallback) is delegated to `<Video>` —
 * the single source of truth.
 *
 * YouTube takes precedence over the uploaded video when both
 * `youtubeUrl` and `mainVideoUrl` are present. That precedence is
 * resolved here (in the section wrapper) rather than inside `<Video>`,
 * so the underlying primitive stays single-source-per-render.
 */

/** The tab row's layout, read by the section and by its skeleton, so the skeleton is the section's size. */
const VIDEO_TAB_LIST_CLASS = 'inline-flex h-auto justify-start gap-0 rounded-none bg-transparent p-0';
const VIDEO_TAB_TRIGGER_CLASS =
  'rounded-none border-b-2 border-transparent px-4 py-3 text-ods-text-secondary data-[state=active]:border-ods-accent data-[state=active]:bg-transparent data-[state=active]:text-ods-text-primary data-[state=active]:shadow-none content-md:px-6';
const VIDEO_TAB_CONTENT_CLASS = 'mt-4';
const FULL_VIDEO_TAB_LABEL = 'Full Video';
const HIGHLIGHTS_TAB_LABEL = 'Highlights';

interface MarkdownRendererProps {
  content: string;
}

export interface EntityVideoSectionProps {
  /** Main uploaded video URL. */
  mainVideoUrl?: string | null;
  /** YouTube URL (takes priority over `mainVideoUrl` for display). */
  youtubeUrl?: string | null;
  /** AI-generated highlight video URL. */
  highlightVideoUrl?: string | null;
  /** Thumbnail for highlight video. */
  highlightVideoThumbnail?: string | null;
  /** Poster/thumbnail for main video. */
  mainVideoPoster?: string | null;
  /** Title for YouTube embed. */
  title?: string;
  /** AI-generated video summary (markdown). */
  videoSummary?: string | null;
  /** Video bites/teasers array. */
  videoBites?: VideoTeaser[];
  /** Title for the video bites section. Default: 'Key Moments' (unified). */
  bitesTitle?: string;
  /** Whether to filter bites to published only. */
  filterPublishedBites?: boolean;
  /** Section-level profile shown in the strip's hover overlay. */
  bitesProfile?: VideoBiteStripProfile | null;
  /** Navigation target for the strip's overlay footer (the origin entity). */
  bitesHref?: string;
  /** Custom node between the bites heading and the strip (description slot). */
  bitesHeaderSlot?: React.ReactNode;
  /** Navigation fallback for bites without their own href/onNavigate. */
  onBiteNavigate?: (bite: VideoBiteStripItem, index: number) => void;
  /** Marquee auto-scroll for the bites strip. Default true. */
  bitesAutoScroll?: boolean;
  /** Markdown renderer component injected by the host app. */
  MarkdownRenderer?: ComponentType<MarkdownRendererProps>;
  /** HTTPS URL to a VTT captions file (rendered as native `<track>`). */
  captionsUrl?: string | null;
  /**
   * HTTPS URL to the HIGHLIGHT video's VTT captions file — same `<track>`
   * mechanism as `captionsUrl`, applied to the Highlights tab / highlight-only
   * player (`getCaptionsUrl(type, id, highlightSrt, { variant: 'highlight' })`).
   */
  highlightCaptionsUrl?: string | null;
  /**
   * Entity identity for caption derivation — the alternative to the explicit
   * URL props above for hosts that don't hold the entity's SRT columns (chat
   * cards). The section derives both `<track>` URLs itself from the runtime's
   * captions base (`getEntityCaptionUrlsById`); explicit `captionsUrl` /
   * `highlightCaptionsUrl` win when also provided.
   */
  captionsEntity?: { type: string; id: string | number } | null;
  /** LCP hint — when true, the full-video tab's poster eager-loads. */
  priority?: boolean;
}

export function EntityVideoSection({
  mainVideoUrl,
  youtubeUrl,
  highlightVideoUrl,
  highlightVideoThumbnail,
  mainVideoPoster,
  title = 'Video',
  videoSummary,
  videoBites,
  bitesTitle = DEFAULT_VIDEO_BITES_TITLE,
  filterPublishedBites = true,
  bitesProfile = null,
  bitesHref,
  bitesHeaderSlot,
  onBiteNavigate,
  bitesAutoScroll = true,
  MarkdownRenderer,
  captionsUrl: captionsUrlProp,
  highlightCaptionsUrl: highlightCaptionsUrlProp,
  captionsEntity,
  priority = false,
}: EntityVideoSectionProps) {
  const captions = useCaptions();
  const loading = useLoadingScope();
  const hasFullVideo = !!(youtubeUrl || mainVideoUrl);
  const hasHighlight = !!highlightVideoUrl;
  const hasVideo = hasFullVideo || hasHighlight;

  // Caption resolution: explicit URL props win (detail pages gate on their
  // entity's SRT columns); otherwise derive from `captionsEntity` identity —
  // the zero-knowledge path for chat cards.
  const derivedCaptions = captionsEntity ? captions.forEntityId(captionsEntity.type, captionsEntity.id) : null;
  const captionsUrl = captionsUrlProp ?? derivedCaptions?.captionsUrl;
  const highlightCaptionsUrl = highlightCaptionsUrlProp ?? derivedCaptions?.highlightCaptionsUrl;

  // In a loading scope the props are empty: the section is its player while the record is read.
  if (loading) return <EntityVideoSectionSkeleton />;

  if (!hasVideo && !videoSummary && (!videoBites || videoBites.length === 0)) {
    return null;
  }

  // YouTube wins when both URLs are present.
  const fullVideoUrl = youtubeUrl || mainVideoUrl || null;
  const fullVideoKind: 'youtube' | 'auto' = youtubeUrl ? 'youtube' : 'auto';

  return (
    <>
      {/* Branch on the resolved URLs themselves rather than on the derived
          `hasFullVideo` flag: `fullVideoUrl` is truthy exactly when
          `hasFullVideo` is, and testing it directly narrows it to a `string`
          for `<Video url>` without a non-null assertion. `hasHighlight` is a
          single-reference alias of `highlightVideoUrl`, so it narrows on its
          own. */}
      {hasVideo &&
        (fullVideoUrl && hasHighlight ? (
          <Tabs defaultValue="full-video" className="w-full">
            <TabsList className={VIDEO_TAB_LIST_CLASS}>
              <TabsTrigger
                value="full-video"
                className={VIDEO_TAB_TRIGGER_CLASS}
              >
                {FULL_VIDEO_TAB_LABEL}
              </TabsTrigger>
              <TabsTrigger
                value="highlights"
                className={VIDEO_TAB_TRIGGER_CLASS}
              >
                {HIGHLIGHTS_TAB_LABEL}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="full-video" className={VIDEO_TAB_CONTENT_CLASS}>
              <Video
                kind={fullVideoKind}
                url={fullVideoUrl}
                poster={mainVideoPoster}
                title={title}
                captionsUrl={captionsUrl}
                layout="centered"
                priority={priority}
              />
            </TabsContent>

            <TabsContent value="highlights" className={VIDEO_TAB_CONTENT_CLASS}>
              <Video
                url={highlightVideoUrl}
                poster={highlightVideoThumbnail}
                captionsUrl={highlightCaptionsUrl}
                layout="centered"
              />
            </TabsContent>
          </Tabs>
        ) : fullVideoUrl ? (
          <Video
            kind={fullVideoKind}
            url={fullVideoUrl}
            poster={mainVideoPoster}
            title={title}
            captionsUrl={captionsUrl}
            layout="centered"
            priority={priority}
          />
        ) : highlightVideoUrl ? (
          <Video
            url={highlightVideoUrl}
            poster={highlightVideoThumbnail}
            captionsUrl={highlightCaptionsUrl}
            layout="centered"
            priority={priority}
          />
        ) : null)}

      {videoSummary && MarkdownRenderer && (
        <div className="flex w-full min-w-0 flex-col gap-6">
          <h2 className={`${SECTION_HEADING_CLASS} break-words`}>Summary</h2>
          <div className="overflow-hidden break-words text-ods-text-primary text-h4">
            <MarkdownRenderer content={videoSummary} />
          </div>
        </div>
      )}

      {videoBites && videoBites.length > 0 && (
        <VideoBitesStrip
          bites={videoBites}
          title={bitesTitle}
          filterPublished={filterPublishedBites}
          profile={bitesProfile}
          href={bitesHref}
          headerSlot={bitesHeaderSlot}
          onBiteNavigate={onBiteNavigate}
          autoScroll={bitesAutoScroll}
        />
      )}
    </>
  );
}

/**
 * The video section while its record is read: the centered player box (`VideoSkeleton`), under the real static
 * "Full Video" / "Highlights" tab row when `tabs` (a record that has both). Its classes are the section's own.
 */
export function EntityVideoSectionSkeleton({ tabs = false, className }: { tabs?: boolean; className?: string }) {
  if (!tabs) return <VideoSkeleton layout="centered" className={className} />;
  // The real tabs (static labels): TabsTrigger draws its own box in a scope.
  return (
    <Tabs defaultValue="full-video" className={cn('w-full', className)} aria-hidden>
      <TabsList className={VIDEO_TAB_LIST_CLASS}>
        <TabsTrigger value="full-video" className={VIDEO_TAB_TRIGGER_CLASS}>
          {FULL_VIDEO_TAB_LABEL}
        </TabsTrigger>
        <TabsTrigger value="highlights" className={VIDEO_TAB_TRIGGER_CLASS}>
          {HIGHLIGHTS_TAB_LABEL}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="full-video" className={VIDEO_TAB_CONTENT_CLASS}>
        <VideoSkeleton layout="centered" />
      </TabsContent>
    </Tabs>
  );
}
