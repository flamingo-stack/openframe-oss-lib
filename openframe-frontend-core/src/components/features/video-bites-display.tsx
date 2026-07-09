"use client";

import React from 'react';
import type { VideoTeaser } from '../../types/video-processing';
import { VideoBitesStrip } from './video-bites-strip';
import { DEFAULT_VIDEO_BITES_TITLE } from './video-bites-shared';

/**
 * @deprecated Transitional shim — use `<VideoBitesStrip>` directly.
 *
 * The old aspect-ratio GRID rendered here was replaced by the unified
 * strip (`video-bites-strip.tsx`, Figma node 4033-90364). This wrapper
 * keeps the historical 4-prop signature compiling for hub call sites
 * between the lib version bump and the hub-side migration.
 *
 * Scheduled deletion: next lib minor after the hub migration's grep gate
 * confirms zero consumers. Do NOT add features here.
 */

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

export function VideoBitesDisplay({
  bites,
  title = DEFAULT_VIDEO_BITES_TITLE,
  filterPublished = true,
  showTitle = true,
}: VideoBitesDisplayProps) {
  return (
    <VideoBitesStrip
      bites={bites}
      title={title}
      filterPublished={filterPublished}
      showTitle={showTitle}
    />
  );
}
