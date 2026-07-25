"use client";

/**
 * useWalkthroughVideo — client read hook for the per-platform walkthrough video.
 *
 * SSOT for fetching + shaping the widget's data on the CLIENT (any embedder
 * reuses it). The public endpoint returns the RAW body `{ walkthroughVideo }`
 * (no {success,data} wrapper). The video's `captionsUrl` is a RELATIVE
 * `/api/captions/...` path; pass `transformCaptionsUrl` to route it through a
 * proxy (embedders) — omit it for same-origin hosts.
 *
 * SSR hosts (the hub) resolve the video server-side and pass it to the widget
 * directly; they don't need this hook. It exists for client-only embedders.
 */

import { useQuery } from '@tanstack/react-query';
import type { WalkthroughVideoData } from './floating-walkthrough-video';

export interface UseWalkthroughVideoOptions {
  /** Absolute or proxied URL of the public GET route. */
  endpoint: string;
  /** SSR/initial seed to avoid a loading flash. */
  initialData?: WalkthroughVideoData | null;
  enabled?: boolean;
  /** Rewrite the RELATIVE captionsUrl (e.g. prefix a `/content` proxy base). */
  transformCaptionsUrl?: (relativeUrl: string) => string;
}

export interface UseWalkthroughVideoResult {
  video: WalkthroughVideoData | null;
  isLoading: boolean;
}

export function useWalkthroughVideo(opts: UseWalkthroughVideoOptions): UseWalkthroughVideoResult {
  const { endpoint, initialData, enabled = true, transformCaptionsUrl } = opts;

  const query = useQuery<WalkthroughVideoData | null>({
    queryKey: ['walkthrough-video', endpoint],
    enabled,
    initialData,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) return null;
      const body = (await res.json()) as { walkthroughVideo: WalkthroughVideoData | null };
      const video = body?.walkthroughVideo ?? null;
      if (video?.captionsUrl && transformCaptionsUrl && video.captionsUrl.startsWith('/')) {
        return { ...video, captionsUrl: transformCaptionsUrl(video.captionsUrl) };
      }
      return video;
    },
  });

  return { video: query.data ?? null, isLoading: query.isLoading };
}
