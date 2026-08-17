"use client";

/**
 * useWalkthroughVideo — client read hook for the per-platform walkthrough video.
 *
 * SSOT for fetching + shaping the widget's data on the CLIENT (any embedder
 * reuses it). The public endpoint returns the RAW body `{ walkthroughVideo }`
 * (no {success,data} wrapper). The video's `captionsUrl` is a RELATIVE
 * `/api/captions/...` path; it is rebased automatically onto
 * `ChatRuntime.endpoints.captionsUrlPrefix` (the standard runtime-endpoint
 * wiring) — same-origin hosts leave that unset and get the URL unchanged.
 * `transformCaptionsUrl` remains as an explicit override for hosts outside
 * a runtime provider.
 *
 * SSR hosts (the hub) resolve the video server-side and pass it to the widget
 * directly; they don't need this hook. It exists for client-only embedders.
 */

import { useQuery } from '@tanstack/react-query';
import type { WalkthroughVideoData } from './floating-walkthrough-video';
import { rebaseCaptionsUrl } from './captions-url';
import { useChatRuntime } from '../../contexts/chat-runtime-context';

export interface UseWalkthroughVideoOptions {
  /** Absolute or proxied URL of the public GET route. */
  endpoint: string;
  /** SSR/initial seed to avoid a loading flash. */
  initialData?: WalkthroughVideoData | null;
  enabled?: boolean;
  /** Rewrite the RELATIVE captionsUrl (e.g. prefix a `/content` proxy base).
   *  OPTIONAL override — when unset, the URL is rebased onto
   *  `ChatRuntime.endpoints.captionsUrlPrefix` (see `rebaseCaptionsUrl`), so
   *  embedders inside a runtime provider need no wiring here at all. */
  transformCaptionsUrl?: (relativeUrl: string) => string;
}

export interface UseWalkthroughVideoResult {
  video: WalkthroughVideoData | null;
  isLoading: boolean;
}

export function useWalkthroughVideo(opts: UseWalkthroughVideoOptions): UseWalkthroughVideoResult {
  const { endpoint, initialData, enabled = true, transformCaptionsUrl } = opts;
  const runtime = useChatRuntime();

  const query = useQuery<WalkthroughVideoData | null>({
    queryKey: ['walkthrough-video', endpoint],
    enabled,
    initialData: initialData ?? undefined,
    // `null` is a legitimate cached VALUE to React Query, so an embedder
    // passing `initialData={null}` to mean "no seed" got status:'success' and
    // no fetch for the whole staleTime window. Treat null as absent.
    staleTime: 5 * 60 * 1000,
    // Returns the RAW video, cached under the endpoint key. A real HTTP
    // failure THROWS so React Query retries and surfaces isError, instead of
    // caching a fake "no video" for the whole stale window. The hub route
    // answers "no walkthrough for this platform" as 200 + null, not 404; the
    // 404 arm is kept for embedders whose proxy 404s a missing resource.
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
      if (!video?.captionsUrl) return video;
      if (transformCaptionsUrl && video.captionsUrl.startsWith('/')) {
        return { ...video, captionsUrl: transformCaptionsUrl(video.captionsUrl) };
      }
      // Default: rebase onto `endpoints.captionsUrlPrefix`. Same-origin hosts
      // leave it unset and get the URL back unchanged — a no-op for them.
      const rebased = rebaseCaptionsUrl(runtime?.endpoints, video.captionsUrl);
      return rebased === video.captionsUrl ? video : { ...video, captionsUrl: rebased as string };
    },
  });

  return { video: query.data ?? null, isLoading: query.isLoading };
}
