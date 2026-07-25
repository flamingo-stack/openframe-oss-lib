"use client";

import React, { ComponentType } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../ui/tabs';
import type { VideoTeaser } from '../../types/video-processing';
import { Video, type VideoLayout, type VideoPlayerHandle, type VideoMutedFallbackState } from './video';
import { VideoBitesStrip, type VideoBiteStripItem } from './video-bites-strip';
import { DEFAULT_VIDEO_BITES_TITLE, type VideoBiteStripProfile } from './video-bites-shared';
import { SECTION_HEADING_CLASS } from '../layout/page-heading';

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
  /**
   * Raw SRT content. Deprecated — pass `captionsUrl` instead.
   * Forwarded to `<Video>` for the dev-only warning.
   */
  srtContent?: string | null;
  /** HTTPS URL to a VTT captions file (rendered as native `<track>`). */
  captionsUrl?: string | null;
  /** LCP hint — when true, the full-video tab's poster eager-loads. */
  priority?: boolean;
  // --- Playback-handoff pass-throughs (walkthrough theater; forwarded to the
  // full-video <Video> only). Default behavior on detail pages is unchanged. ---
  /** Layout for the full-video <Video>. Default 'centered'; the theater passes
   *  'wide' (in-flow 16:9, no max-width cap). */
  fullVideoLayout?: VideoLayout;
  /** Seek position (seconds) applied on mount to the full video. */
  startTime?: number;
  /** Imperative handle for the full-video player (file branch). */
  playerHandleRef?: React.Ref<VideoPlayerHandle>;
  /** Attempt unmuted autoplay on the full video (file branch); forwarded to the
   *  YouTube branch as `autoActivate`. */
  autoPlayUnmuted?: boolean;
  /** Autoplay MUTED with the unmute affordance armed (reopen-preserving-mute). */
  startMuted?: boolean;
  /** Suppress the full-video player's internal unmute glyph (host renders its own). */
  hideMutedBadge?: boolean;
  /** Muted-fallback state reporter for the full-video player. */
  onMutedFallbackChange?: (state: VideoMutedFallbackState) => void;
  /** `ended` event for the full-video player. */
  onEnded?: () => void;
  /** Close-side pause signal forwarded to the YouTube facade. */
  suspended?: boolean;
  /** Wrap the full-video <Video> in a `sticky top-0 z-10` container so it pins
   *  while the summary scrolls beneath it (the mobile theater sheet). */
  stickyVideo?: boolean;
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
  srtContent,
  captionsUrl,
  priority = false,
  fullVideoLayout = 'centered',
  startTime,
  playerHandleRef,
  autoPlayUnmuted,
  startMuted,
  hideMutedBadge,
  onMutedFallbackChange,
  onEnded,
  suspended,
  stickyVideo = false,
}: EntityVideoSectionProps) {
  const hasFullVideo = !!(youtubeUrl || mainVideoUrl);
  const hasHighlight = !!highlightVideoUrl;
  const hasVideo = hasFullVideo || hasHighlight;

  if (!hasVideo && !videoSummary && (!videoBites || videoBites.length === 0)) {
    return null;
  }

  // YouTube wins when both URLs are present.
  const fullVideoUrl = youtubeUrl || mainVideoUrl || null;
  const fullVideoKind: 'youtube' | 'auto' = youtubeUrl ? 'youtube' : 'auto';

  // The full-video <Video>, shared by the tabbed and standalone renders. Carries
  // every playback-handoff prop (no-ops on detail pages, which pass none).
  const fullVideo = fullVideoUrl ? (
    <Video
      kind={fullVideoKind}
      url={fullVideoUrl}
      poster={mainVideoPoster}
      title={title}
      srtContent={srtContent}
      captionsUrl={captionsUrl}
      layout={fullVideoLayout}
      priority={priority}
      startTime={startTime}
      playerHandleRef={playerHandleRef}
      autoPlayUnmuted={autoPlayUnmuted}
      startMuted={startMuted}
      autoActivate={autoPlayUnmuted || startMuted}
      suspended={suspended}
      hideMutedBadge={hideMutedBadge}
      onMutedFallbackChange={onMutedFallbackChange}
      onEnded={onEnded}
    />
  ) : null;
  const fullVideoNode = stickyVideo ? (
    <div className="sticky top-0 z-10">{fullVideo}</div>
  ) : (
    fullVideo
  );

  return (
    <>
      {hasVideo &&
        (hasFullVideo && hasHighlight ? (
          <Tabs defaultValue="full-video" className="w-full">
            <TabsList className="inline-flex justify-start rounded-none bg-transparent h-auto p-0 gap-0">
              <TabsTrigger
                value="full-video"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-ods-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 md:px-6 py-3 text-ods-text-secondary data-[state=active]:text-ods-text-primary"
              >
                Full Video
              </TabsTrigger>
              <TabsTrigger
                value="highlights"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-ods-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 md:px-6 py-3 text-ods-text-secondary data-[state=active]:text-ods-text-primary"
              >
                Highlights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="full-video" className="mt-4">
              {fullVideoNode}
            </TabsContent>

            <TabsContent value="highlights" className="mt-4">
              <Video
                url={highlightVideoUrl!}
                poster={highlightVideoThumbnail}
                layout="centered"
              />
            </TabsContent>
          </Tabs>
        ) : hasFullVideo ? (
          fullVideoNode
        ) : (
          <Video
            url={highlightVideoUrl!}
            poster={highlightVideoThumbnail}
            layout="centered"
            priority={priority}
          />
        ))}

      {videoSummary && MarkdownRenderer && (
        <div className="flex flex-col gap-6 w-full min-w-0">
          <h2 className={`${SECTION_HEADING_CLASS} break-words`}>
            Summary
          </h2>
          <div className="text-h4 text-ods-text-primary break-words overflow-hidden">
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
