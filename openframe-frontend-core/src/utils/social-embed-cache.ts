// Unified Social Media Embed fetch layer.
// Shared between Reddit and Twitter embed clients for consistent behavior.
//
// SIMPLIFIED (2026-08, "all 58 Reddit embeds broken" incident): the server
// proxy is now the single authority — it owns a DURABLE database cache and
// the authenticated upstream fetch (Reddit's `.json` API 403s all
// unauthenticated clients, so the old browser direct-fetch could never work
// again). The old client-side hierarchy (cache-only preflight round-trip,
// direct browser fetch, client→server POST cache pushes, background
// refreshes) was flaky machinery layered over an unreliable server cache and
// is DELETED — do not reintroduce it. Client flow is exactly:
//
//   memory (per-pageload dedupe) → GET proxy (server cache + upstream)
//
// Endpoint paths are passed in via `apiEndpoint` on each call so embedders
// can route through their own reverse proxy (e.g. `/content/api/blog/reddit-proxy`).

// Per-pageload memory cache shared between component instances. The cache is
// payload-agnostic — each caller's `dataValidator` is what turns an entry back
// into its own concrete shape.
const dataCache = new Map<string, unknown>();

// In-flight GET dedupe: several embeds of the same URL mount concurrently
// (before any of them has populated the memory cache).
const inflightRequests = new Map<string, Promise<unknown>>();

export interface FetchOptions<TData> {
  platform: 'reddit' | 'twitter';
  url: string;
  apiEndpoint: string;
  /** Type guard for the proxy payload. This module never knows the shape, so
   *  the caller's guard is the single place `unknown` becomes `TData`. */
  dataValidator: (data: unknown) => data is TData;
  onDataUpdate: (data: TData) => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
}

export class SocialEmbedCache {
  private static instance: SocialEmbedCache;

  static getInstance(): SocialEmbedCache {
    if (!SocialEmbedCache.instance) {
      SocialEmbedCache.instance = new SocialEmbedCache();
    }
    return SocialEmbedCache.instance;
  }

  getFromMemory(url: string): unknown {
    return dataCache.get(url) ?? null;
  }

  setInMemory(url: string, data: unknown): void {
    dataCache.set(url, data);
  }

  /**
   * Memory → proxy. Kept the historical name so the embed clients'
   * call sites are unchanged.
   */
  async fetchWithHierarchy<TData>(options: FetchOptions<TData>): Promise<void> {
    const { url, platform, apiEndpoint, dataValidator, onDataUpdate, onError, onLoading } = options;

    const memoryData = this.getFromMemory(url);
    if (dataValidator(memoryData)) {
      onDataUpdate(memoryData);
      onLoading(false);
      return;
    }

    try {
      const data = await this.fetchFromProxy(url, apiEndpoint, dataValidator);
      if (data) {
        this.setInMemory(url, data);
        onDataUpdate(data);
        onLoading(false);
        return;
      }
      // Structured 404 from the proxy — the content itself is unavailable.
      onError(`This ${platform === 'reddit' ? 'Reddit post' : 'tweet'} could not be loaded.`);
    } catch (error) {
      console.log(`❌ [${platform} embed] Proxy fetch failed for: ${url}`, error);
      onError(`Unable to load ${platform} content`);
    }
    onLoading(false);
  }

  /**
   * Returns the validated payload, `null` for a structured "content
   * unavailable" 404, and throws for everything else. Concurrent calls for
   * the same URL share one request.
   */
  private fetchFromProxy<TData>(
    url: string,
    apiEndpoint: string,
    dataValidator: (data: unknown) => data is TData,
  ): Promise<TData | null> {
    const inflight = inflightRequests.get(url);
    // A shared in-flight request resolves to `unknown` (the map is
    // payload-agnostic) — re-run THIS caller's guard on the result rather
    // than asserting it. Rejections still propagate to every sharer.
    if (inflight) return inflight.then(data => (dataValidator(data) ? data : null));

    const request = (async (): Promise<TData | null> => {
      const response = await fetch(`${apiEndpoint}?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const data: unknown = await response.json();
        if (dataValidator(data)) return data;
        throw new Error('Server proxy returned invalid data shape');
      }
      if (response.status === 404) return null;
      throw new Error(`Server proxy failed: ${response.status}`);
    })();

    // Hold the tracked promise instead of storing it and reading it back out
    // of the map: it is the same object, and the caller now gets it directly
    // rather than through a lookup whose key the `finally` above will delete.
    const tracked = request.finally(() => inflightRequests.delete(url));
    inflightRequests.set(url, tracked);
    return tracked;
  }
}

export const socialCache = SocialEmbedCache.getInstance();
