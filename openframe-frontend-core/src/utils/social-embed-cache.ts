// Unified Social Media Embed Caching System
// Shared between Reddit and Twitter embeds for consistent behavior.
//
// Lifted from hub `lib/utils/social-embed-cache.ts` so the lib's
// RichMarkdownRenderer satellites (reddit/twitter embed clients) can
// share it without an `@/lib/...` hub dependency. Pure-TS; no React.
//
// Endpoint paths are passed in via `apiEndpoint` on each call so embedders
// can route through their own reverse proxy (e.g. `/content/api/blog/reddit-proxy`).

// Global request deduplication to prevent duplicate caching requests
const cachingRequests = new Map<string, Promise<void>>();

// Global data cache to share fetched data between component instances
const dataCache = new Map<string, any>();

// Global refresh tracking to prevent duplicate background refreshes
const refreshTimestamps = new Map<string, number>();

interface CacheOptions {
  platform: 'reddit' | 'twitter';
  url: string;
  apiEndpoint: string;
}

export class SocialEmbedCache {
  private static instance: SocialEmbedCache;

  static getInstance(): SocialEmbedCache {
    if (!SocialEmbedCache.instance) {
      SocialEmbedCache.instance = new SocialEmbedCache();
    }
    return SocialEmbedCache.instance;
  }

  // Check if data exists in memory cache
  getFromMemory(url: string): any | null {
    return dataCache.get(url) || null;
  }

  // Store data in memory cache
  setInMemory(url: string, data: any): void {
    dataCache.set(url, data);
  }

  // Check server cache (cache-only mode)
  async getFromServer(options: CacheOptions): Promise<any | null> {
    try {
      console.log(`🔍 [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] Checking server cache for: ${options.url}`);
      const response = await fetch(`${options.apiEndpoint}?url=${encodeURIComponent(options.url)}&cache-only=true`);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] Server cache hit: ${options.url}`);
        return data;
      } else if (response.status === 404) {
        console.log(`💨 [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] No server cache available for: ${options.url}`);
        return null;
      }
    } catch (error) {
      console.log(`❌ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] Server cache check failed for: ${options.url}`, error);
    }
    return null;
  }

  // Helper method to update server cache asynchronously
  private async updateServerCache(apiEndpoint: string, url: string, data: any): Promise<void> {
    try {
      console.log(`💾 [Cache] Updating server cache for: ${url}`);
      await fetch(`${apiEndpoint}?url=${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      console.log(`✅ [Cache] Server cache updated for: ${url}`);
    } catch (error) {
      console.log(`❌ [Cache] Server cache update failed for: ${url}`, error);
    }
  }

  // Store data in server cache (with deduplication)
  async setInServer(options: CacheOptions, data: any): Promise<void> {
    const cacheKey = `${options.platform}-${options.url}`;

    // Prevent duplicate caching requests
    if (cachingRequests.has(cacheKey)) {
      console.log(`⏭️ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] Server cache update skipped (already in progress): ${options.url}`);
      return;
    }

    console.log(`💾 [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] Updating server cache for: ${options.url}`);
    const cachePromise = fetch(`${options.apiEndpoint}?url=${encodeURIComponent(options.url)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(() => {
      console.log(`✅ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] Server cache updated successfully: ${options.url}`);
      cachingRequests.delete(cacheKey);
    }).catch((error) => {
      console.log(`❌ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Cache] Server cache update failed: ${options.url}`, error);
      cachingRequests.delete(cacheKey);
    });

    cachingRequests.set(cacheKey, cachePromise);
    await cachePromise;
  }

  // Direct fetch with platform-specific logic
  async fetchDirect(options: CacheOptions & {
    directFetcher: () => Promise<any>
  }): Promise<any | null> {
    try {
      console.log(`🔄 [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Direct] Fetching content: ${options.url}`);
      const result = await options.directFetcher();
      console.log(`✅ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Direct] Fetch successful: ${options.url}`);
      return result;
    } catch (error) {
      console.log(`❌ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Direct] Fetch failed: ${options.url}`, error);
      return null;
    }
  }

  // Unified cache hierarchy: Memory → Server → Direct
  async fetchWithHierarchy(options: CacheOptions & {
    dataValidator: (data: any) => boolean;
    onDataUpdate: (data: any) => void;
    onError: (error: string) => void;
    onLoading: (loading: boolean) => void;
  }): Promise<void> {
    const { url, platform, onDataUpdate, onError, onLoading, dataValidator } = options;
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    // Schedule background refresh for ALL loads (not just cache hits)
    this.scheduleAsyncRefresh(platform, url, dataValidator, options.apiEndpoint);

    // Step 1: Check memory cache first
    console.log(`🔍 [${platformName} Cache] Checking memory cache for: ${url}`);
    const memoryData = this.getFromMemory(url);
    if (memoryData && dataValidator(memoryData)) {
      console.log(`💎 [${platformName} Cache] Memory cache hit for: ${url}`);
      onDataUpdate(memoryData);
      onLoading(false);
      return;
    }

    // Step 2: Check server cache (file system cache)
    console.log(`🔍 [${platformName} Cache] No memory cache, checking server cache for: ${url}`);
    const serverCacheData = await this.getFromServer(options);
    if (serverCacheData && dataValidator(serverCacheData)) {
      console.log(`🎯 [${platformName} Cache] Server cache hit (cached data) for: ${url}`);
      onDataUpdate(serverCacheData);
      this.setInMemory(url, serverCacheData); // Update memory cache
      onLoading(false);
      return;
    }

    // Step 3: Direct fetch from browser (bypasses server proxy)
    console.log(`🔍 [${platformName} Cache] No server cache, attempting direct fetch for: ${url}`);

    // For Reddit, try direct browser fetch first (CORS enabled). Use
    // `AbortSignal.timeout(...)` to bound the wait — without it a hung
    // upstream (Reddit dropping the connection without RST, or a captive-
    // portal proxy stalling) would block this code path indefinitely and
    // never fall through to the server proxy.
    if (platform === 'reddit') {
      try {
        const directResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();
          if (directData && dataValidator(directData)) {
            console.log(`✅ [${platformName} Direct] Browser direct fetch successful for: ${url}`);
            onDataUpdate(directData);
            this.setInMemory(url, directData);
            onLoading(false);

            // Async server cache update
            setTimeout(() => {
              this.updateServerCache(options.apiEndpoint, url, directData);
            }, 0);
            return;
          }
        }
        console.log(`💨 [${platformName} Direct] Browser direct fetch failed (${directResponse.status}), trying server proxy...`);
      } catch (directError) {
        console.log(`💨 [${platformName} Direct] Browser direct fetch failed, trying server proxy...`, directError);
      }
    }

    // Step 4: Server proxy as fallback
    console.log(`🔍 [${platformName} Cache] Trying server proxy for: ${url}`);
    try {
      const response = await fetch(`${options.apiEndpoint}?url=${encodeURIComponent(url)}`);

      if (response.ok) {
        const serverData = await response.json();
        if (serverData && dataValidator(serverData)) {
          // Check X-Cache header to determine if this was a true cache hit or fresh fetch
          const cacheStatus = response.headers.get('x-cache') || 'UNKNOWN';
          if (cacheStatus === 'HIT') {
            console.log(`🎯 [${platformName} Proxy] Server cache hit (cached data) for: ${url}`);
          } else if (cacheStatus === 'MISS-FETCHED') {
            console.log(`🔄 [${platformName} Proxy] Server processed fresh fetch (now cached) for: ${url}`);
          } else {
            console.log(`✅ [${platformName} Proxy] Server returned data (${cacheStatus}) for: ${url}`);
          }
          onDataUpdate(serverData);
          this.setInMemory(url, serverData);
          onLoading(false);
          return;
        } else {
          // 200 with a body that fails our shape check — throw so the
          // outer catch surfaces `onError` instead of silently dropping.
          console.log(`⚠️ [${platformName} Proxy] Server returned data but validation failed for: ${url}`);
          throw new Error('Server proxy returned invalid data shape');
        }
      } else {
        // The Response body is a one-shot stream — read it ONCE and branch
        // on shape afterwards. The previous code parsed 404s, fell through
        // to the generic-error path, and then called `response.json()` a
        // second time, which throws `TypeError: body stream already read`
        // and masks the real status with a confusing error.
        let errorData: { error?: string; message?: string } | null = null;
        try {
          errorData = await response.json();
        } catch {
          // Body wasn't JSON; errorData stays null and we fall through.
        }
        if (response.status === 404 && errorData?.error && errorData?.message) {
          // Structured 404 (e.g. an unavailable Reddit post). Surface
          // the proxy's message directly to the consumer.
          console.log(`🚫 [${platformName} Proxy] Content unavailable: ${errorData.message}`);
          onError(errorData.message);
          onLoading(false);
          return;
        }
        if (errorData?.error) {
          throw new Error(`Server error: ${errorData.error}`);
        }
        throw new Error(`Server proxy failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ [${platformName} Cache] All fetch attempts failed for: ${url}`, error);
      onError(`Unable to load ${platform} content`);
      onLoading(false);
    }
  }

  // Schedule async background refresh (runs once, 1 second after load)
  //
  // The hub's old version hard-coded `/api/blog/{reddit,twitter}-proxy`. We
  // now require `apiEndpoint` so embedders can route through their own
  // reverse proxy (e.g. `/content/api/blog/...`).
  private scheduleAsyncRefresh(
    platform: string,
    url: string,
    dataValidator: (data: any) => boolean,
    apiEndpoint: string,
  ): void {
    setTimeout(() => {
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      console.log(`🔄 [${platformName} Async] Background refresh starting for: ${url}`);

      fetch(`${apiEndpoint}?url=${encodeURIComponent(url)}`)
        .then(response => {
          if (response.ok) {
            return response.json();
          } else {
            console.log(`❌ [${platformName} Async] Background refresh failed (${response.status}) for: ${url}`);
            return null;
          }
        })
        .then(data => {
          if (data && dataValidator(data)) {
            this.setInMemory(url, data);
            console.log(`✅ [${platformName} Async] Background refresh completed for: ${url}`);
          } else if (data) {
            console.log(`❌ [${platformName} Async] Background refresh failed (invalid data) for: ${url}`);
          }
        })
        .catch((error) => console.log(`❌ [${platformName} Async] Background refresh failed for: ${url}`, error));
    }, 1000); // Runs exactly once, 1 second after load
  }

  // Background refresh to keep cache fresh (with request deduplication)
  private async backgroundRefresh(options: CacheOptions & {
    directFetcher: () => Promise<any>;
    dataValidator: (data: any) => boolean;
    onDataUpdate: (data: any) => void;
  }, currentData: any): Promise<void> {
    const refreshKey = `refresh-${options.platform}-${options.url}`;
    const now = Date.now();

    // Check if we've refreshed this URL recently (within 30 seconds)
    const lastRefresh = refreshTimestamps.get(refreshKey);
    if (lastRefresh && (now - lastRefresh) < 30000) {
      console.log(`⏭️ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Background] Refresh skipped (recent refresh): ${options.url}`);
      return;
    }

    // Prevent multiple background refresh requests for the same URL
    if (cachingRequests.has(refreshKey)) {
      console.log(`⏭️ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Background] Refresh skipped (already in progress): ${options.url}`);
      return;
    }

    const refreshPromise = (async () => {
      try {
        console.log(`🔄 [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Background] Starting background refresh for: ${options.url}`);
        refreshTimestamps.set(refreshKey, now);

        const freshData = await this.fetchDirect(options);

        if (freshData && options.dataValidator(freshData)) {
          // Update cache silently without triggering UI re-render
          this.setInMemory(options.url, freshData);
          await this.setInServer(options, freshData);

          console.log(`✅ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Background] Background refresh completed for: ${options.url}`);
        } else {
          console.log(`❌ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Background] Background refresh failed (invalid data) for: ${options.url}`);
        }
      } catch (error) {
        console.log(`❌ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Background] Background refresh failed for: ${options.url}`, error);
      } finally {
        cachingRequests.delete(refreshKey);
      }
    })();

    cachingRequests.set(refreshKey, refreshPromise);
    await refreshPromise;
  }

  // Silent background refresh for UI-sensitive components
  private silentBackgroundRefresh(options: CacheOptions & {
    directFetcher: () => Promise<any>;
    dataValidator: (data: any) => boolean;
  }): void {
    const refreshKey = `silent-refresh-${options.platform}-${options.url}`;
    const now = Date.now();

    // Check if we've refreshed this URL recently (within 5 minutes for silent refresh)
    const lastRefresh = refreshTimestamps.get(refreshKey);
    if (lastRefresh && (now - lastRefresh) < 300000) {
      console.log(`⏭️ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Silent] Silent refresh skipped (recent refresh): ${options.url}`);
      return; // Skip if refreshed within 5 minutes
    }

    // Prevent multiple silent refresh requests for the same URL
    if (cachingRequests.has(refreshKey)) {
      console.log(`⏭️ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Silent] Silent refresh skipped (already in progress): ${options.url}`);
      return;
    }

    // Run in next tick to avoid blocking UI thread
    setTimeout(() => {
      const refreshPromise = (async () => {
        try {
          console.log(`🔄 [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Silent] Starting silent background refresh for: ${options.url}`);
          refreshTimestamps.set(refreshKey, now);

          // Fetch fresh data silently
          const freshData = await this.fetchDirect(options);

          if (freshData && options.dataValidator(freshData)) {
            // Update cache silently - no UI notifications
            this.setInMemory(options.url, freshData);
            await this.setInServer(options, freshData);
            console.log(`✅ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Silent] Silent refresh completed for: ${options.url}`);
          } else {
            console.log(`❌ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Silent] Silent refresh failed (invalid data) for: ${options.url}`);
          }
        } catch (error) {
          console.log(`❌ [${options.platform.charAt(0).toUpperCase() + options.platform.slice(1)} Silent] Silent refresh failed for: ${options.url}`, error);
        } finally {
          cachingRequests.delete(refreshKey);
        }
      })();

      cachingRequests.set(refreshKey, refreshPromise);
    }, 0); // Defer to next event loop tick
  }
}

export const socialCache = SocialEmbedCache.getInstance();
