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
    // queryFn returns the RAW video and caches it under the endpoint key. A
    // real HTTP failure THROWS (so React Query retries / surfaces isError
    // instead of caching a fake "no video" for the whole stale window); only
    // the endpoint's documented 404 = "no walkthrough for this platform" maps
    // to a cached null.
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Walkthrough video request failed (${res.status})`);
      const body = (await res.json()) as { walkthroughVideo: WalkthroughVideoData | null };
      return body?.walkthroughVideo ?? null;
    },
    // Per-observer transform — NEVER mutate the cached data. `select` also runs
    // over `initialData`, so the SSR seed is rewritten too. Keeping the proxy
    // rewrite here (not in queryFn) means a second consumer of the same
    // endpoint can't inherit this observer's proxied captionsUrl from the cache.
    select: (video) => {
      if (video?.captionsUrl && transformCaptionsUrl && video.captionsUrl.startsWith('/')) {
        return { ...video, captionsUrl: transformCaptionsUrl(video.captionsUrl) };
      }
      return video;
    },
  });

  return { video: query.data ?? null, isLoading: query.isLoading };
}
