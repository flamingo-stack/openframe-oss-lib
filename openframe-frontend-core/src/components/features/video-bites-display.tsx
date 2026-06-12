"use client";

import React, { useMemo } from 'react';
import { Card } from '../ui/card';
import { useNearViewport } from '../../hooks/use-near-viewport';
import type { VideoTeaser } from '../../types/video-processing';
import { Video } from './video';
import { SECTION_HEADING_CLASS } from '../layout/page-heading';
import {
  RatioTabs,
  groupByAspectRatio,
  detectAspectRatio,
  ratioToCategory,
  RATIO_DISPLAY_GRID_CLASS,
  type VideoTeaserWithRatio,
  type RatioCategory,
} from './video-ratio-tabs';

/**
 * <VideoBitesDisplay> — public grid of short video bites grouped by
 * aspect ratio.
 *
 * Goes through `<Video>` for every clip — bites are no longer carved
 * out to raw `<VideoPlayer>`. The previous carve-out existed because
 * react-player's hls.js bundle was ~80KB and short clips didn't need
 * adaptive bitrate. With MuxPlayer, the player loads its HLS engine
 * lazily — for a plain MP4 source it's a thin shell around `<video>`,
 * so the carve-out costs more in complexity than it saves in bytes.
 *
 * `LazyBite` defers mount until the wrapper enters the IO `500px`
 * margin so off-screen bites don't even render their player. Same
 * `useNearViewport` singleton used everywhere else in the lib.
 */

// =============================================================================
// LazyBite — viewport-gated wrapper for video bite cards
// =============================================================================

/** Aspect-ratio-aware placeholder prevents CLS across the grid. */
const RATIO_TO_CSS_ASPECT: Record<RatioCategory, string> = {
  portrait: '9 / 16',
  square: '1 / 1',
  landscape: '16 / 9',
};

interface LazyBiteProps {
  /** Aspect ratio of the wrapped bite — placeholder keeps layout stable. */
  ratio: RatioCategory;
  /** Card rendered once the wrapper enters (within `500px` of) the viewport. */
  children: React.ReactNode;
}

/**
 * Defers mounting an off-screen video bite until it scrolls within
 * ~500px of the viewport. Renders an aspect-ratio-matched placeholder
 * beforehand so layout stays stable.
 *
 * Placeholder bg matches the wrapped `<Card>` background (`bg-ods-card`)
 * so the swap-in is visually seamless and avoids a flash on hydration.
 */
function LazyBite({ ratio, children }: LazyBiteProps) {
  const { ref, isNear } = useNearViewport<HTMLDivElement>('500px');

  return (
    <div ref={ref} style={{ aspectRatio: RATIO_TO_CSS_ASPECT[ratio] }}>
      {isNear ? children : <div className="w-full h-full bg-ods-card rounded-md" />}
    </div>
  );
}

// =============================================================================
// Public component
// =============================================================================

export interface VideoBitesDisplayProps {
  /** Array of video bites/teasers to display. */
  bites: VideoTeaser[];
  /** Title for the section. */
  title?: string;
  /** Whether to filter to only show published bites. Default `true`. */
  filterPublished?: boolean;
  /** Whether to show the title section heading. Default `true`. */
  showTitle?: boolean;
}

/**
 * Unified video-bites grid.
 *
 * Groups by aspect ratio when multiple ratios are present, otherwise
 * renders a flat grid. Each bite mounts lazily via `LazyBite` so
 * off-screen players don't cost the page.
 */
export function VideoBitesDisplay({
  bites,
  title = 'Video Highlights',
  filterPublished = true,
  showTitle = true,
}: VideoBitesDisplayProps) {
  const grouped = useMemo(() => {
    const filtered = filterPublished ? bites.filter(b => b.published) : bites;

    const sorted = [...filtered].sort((a, b) => {
      if (!a.created_at && !b.created_at) return 0;
      if (!a.created_at) return 1;
      if (!b.created_at) return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return groupByAspectRatio(sorted, b =>
      detectAspectRatio((b as VideoTeaserWithRatio).aspect_ratio),
    );
  }, [bites, filterPublished]);

  const totalCount = grouped.portrait.length + grouped.square.length + grouped.landscape.length;
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {showTitle && (
        <h2 className={`${SECTION_HEADING_CLASS} break-words`}>
          {title}
        </h2>
      )}

      {grouped.hasMultiple ? (
        <RatioTabs
          groups={{
            portrait: {
              count: grouped.portrait.length,
              render: () => <BiteGrid bites={grouped.portrait} ratio="portrait" />,
            },
            square: {
              count: grouped.square.length,
              render: () => <BiteGrid bites={grouped.square} ratio="square" />,
            },
            landscape: {
              count: grouped.landscape.length,
              render: () => <BiteGrid bites={grouped.landscape} ratio="landscape" />,
            },
          }}
        />
      ) : (
        <BiteGrid
          bites={
            grouped.portrait.length > 0
              ? grouped.portrait
              : grouped.square.length > 0
                ? grouped.square
                : grouped.landscape
          }
          ratio={
            grouped.portrait.length > 0
              ? 'portrait'
              : grouped.square.length > 0
                ? 'square'
                : 'landscape'
          }
        />
      )}
    </div>
  );
}

// =============================================================================
// Internals
// =============================================================================

/**
 * Renders a grid of bite cards with ratio-appropriate column layout.
 * Each card is wrapped in `LazyBite` so off-screen bites don't mount
 * their player until they scroll near the viewport.
 */
function BiteGrid({ bites, ratio }: { bites: VideoTeaser[]; ratio: RatioCategory }) {
  return (
    <div className={RATIO_DISPLAY_GRID_CLASS[ratio]}>
      {bites.map((bite, index) => (
        <LazyBite key={bite.url || index} ratio={ratio}>
          <VideoBiteCard url={bite.url} title={bite.title} thumbnailUrl={bite.thumbnail_url} />
        </LazyBite>
      ))}
    </div>
  );
}

interface VideoBiteCardProps {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Individual bite card — routes through `<Video>` so the SSoT player
 * is the only video primitive in the lib.
 *
 * Layout: `LazyBite` sets the OUTER `aspectRatio` (portrait/square/landscape),
 * but `<Card>` between LazyBite and `<Video>` has no intrinsic height, so
 * we wrap `<Video>` in `layout="fill"` + an explicit `relative` parent so
 * the player fills the bite's aspect box from first paint. Otherwise
 * MuxPlayer renders at its intrinsic default size and grows once metadata
 * loads — the same CLS that hits the centered layout.
 */
function VideoBiteCard({ url, title, thumbnailUrl }: VideoBiteCardProps) {
  return (
    <Card className="overflow-hidden border border-ods-border bg-ods-card hover:border-ods-accent transition-colors flex flex-col h-full">
      <div className="relative flex-1 min-h-0">
        <Video url={url} poster={thumbnailUrl || undefined} layout="fill" />
      </div>
      {title && (
        <div className="p-4">
          <p className="text-h4 text-ods-text-primary line-clamp-2" title={title}>{title}</p>
        </div>
      )}
    </Card>
  );
}

export { VideoBiteCard };
