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

// Per-pageload memory cache shared between component instances.
const dataCache = new Map<string, any>();

// In-flight GET dedupe: several embeds of the same URL mount concurrently
// (before any of them has populated the memory cache).
const inflightRequests = new Map<string, Promise<any | null>>();

interface FetchOptions {
  platform: 'reddit' | 'twitter';
  url: string;
  apiEndpoint: string;
  dataValidator: (data: any) => boolean;
  onDataUpdate: (data: any) => void;
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

  getFromMemory(url: string): any | null {
    return dataCache.get(url) || null;
  }

  setInMemory(url: string, data: any): void {
    dataCache.set(url, data);
  }

  /**
   * Memory → proxy. Kept the historical name so the embed clients'
   * call sites are unchanged.
   */
  async fetchWithHierarchy(options: FetchOptions): Promise<void> {
    const { url, platform, apiEndpoint, dataValidator, onDataUpdate, onError, onLoading } = options;

    const memoryData = this.getFromMemory(url);
    if (memoryData && dataValidator(memoryData)) {
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
  private fetchFromProxy(
    url: string,
    apiEndpoint: string,
    dataValidator: (data: any) => boolean
  ): Promise<any | null> {
    const inflight = inflightRequests.get(url);
    if (inflight) return inflight;

    const request = (async () => {
      const response = await fetch(`${apiEndpoint}?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data && dataValidator(data)) return data;
        throw new Error('Server proxy returned invalid data shape');
      }
      if (response.status === 404) return null;
      throw new Error(`Server proxy failed: ${response.status}`);
    })();

    inflightRequests.set(
      url,
      request.finally(() => inflightRequests.delete(url))
    );
    return inflightRequests.get(url)!;
  }
}

export const socialCache = SocialEmbedCache.getInstance();
