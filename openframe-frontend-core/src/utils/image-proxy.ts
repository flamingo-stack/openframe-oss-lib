/**
 * Pure image-proxy URL builder + helpers.
 *
 * Lib-side replacement for the hub's `lib/utils/image-proxy.ts`. The
 * hub used to hardcode `/api/image-proxy` + an `openmsp.ai` skip-domain;
 * this version takes BOTH as parameters so embedded apps (and other
 * platforms that host the lib) can wire their own proxy prefix + skip
 * list at the runtime layer.
 *
 * Pure function — no side effects, no env reads. Callers thread the
 * proxy config through (typically from `ChatRuntime.endpoints.imageProxyUrlPrefix`).
 */

export type GetProxiedImageUrlOptions = {
  /**
   * URL prefix for the image proxy (`<prefix>?url=<encoded>`). When unset,
   * `getProxiedImageUrl` returns the original URL unchanged — relative
   * URLs always pass through. Hub default: `/api/image-proxy`.
   */
  proxyPrefix?: string;
  /**
   * Domains that should bypass the proxy (e.g. own-CDN hosts whose
   * `Content-Type` is reliable and that already serve CORS-permitting
   * headers). Matched as `imageUrl.includes(domain)` so subdomains
   * inherit. Default: `[]`.
   */
  skipDomains?: string[];
  /**
   * Return the original `https://` URL so the browser loads it directly
   * (no proxy). Use when upstream `Content-Type` breaks the proxy (common
   * with SVG on some CDNs) or you want the origin to see the client
   * request. HTTP stays proxied (mixed content / legacy).
   */
  directHttps?: boolean;
};

/**
 * Resolve an external image URL through (or around) the image proxy.
 *
 * Resolution order:
 *   1. `imageUrl` already contains `proxyPrefix` → return unchanged
 *      (self-skip — prevents double-wrap).
 *   2. `directHttps` set AND `imageUrl` starts with `https://` → return
 *      unchanged.
 *   3. `imageUrl` doesn't start with `http://` or `https://` → return
 *      unchanged (relative URLs pass through).
 *   4. `proxyPrefix` unset → return unchanged.
 *   5. `skipDomains` matches the URL's host → return unchanged.
 *   6. Else return `<proxyPrefix>?url=<encoded>`.
 */
export function getProxiedImageUrl(
  imageUrl: string | null,
  options?: GetProxiedImageUrlOptions,
): string | null {
  if (!imageUrl) return null;

  const proxyPrefix = options?.proxyPrefix;
  const skipDomains = options?.skipDomains ?? [];
  const directHttps = options?.directHttps ?? false;

  // (1) Self-skip — already proxied. Check this BEFORE the http/https
  // gate so an absolute proxy URL passed in (e.g. `https://hub.example/api/image-proxy?url=…`)
  // is treated as already-proxied even though it starts with https://.
  if (proxyPrefix && imageUrl.includes(proxyPrefix)) {
    return imageUrl;
  }

  // (3) Relative URLs / data: / blob: — return as-is.
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // (2) Direct-https opt-out — only applies to https (http stays proxied).
  if (directHttps && imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // (4) No proxy configured — return as-is.
  if (!proxyPrefix) {
    return imageUrl;
  }

  // (5) Skip-list match.
  for (const domain of skipDomains) {
    if (imageUrl.includes(domain)) {
      return imageUrl;
    }
  }

  // (6) Proxy.
  return `${proxyPrefix}?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * Heuristic: URL path looks like an SVG. Useful with `{ directHttps: true }`
 * when only SVGs misbehave through the proxy; raster images can stay
 * proxied if you prefer.
 */
export function urlPathLooksLikeSvg(imageUrl: string): boolean {
  try {
    return /\.svg$/i.test(new URL(imageUrl).pathname);
  } catch {
    return /\.svg(\?|#|$)/i.test(imageUrl);
  }
}

/**
 * Check if an image URL needs to be proxied. `proxyPrefix` is the same
 * value passed to `getProxiedImageUrl` — used to short-circuit the
 * self-skip case.
 */
export function shouldProxyImage(
  imageUrl: string | null,
  proxyPrefix?: string,
): boolean {
  if (!imageUrl) return false;
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) return false;
  if (proxyPrefix && imageUrl.includes(proxyPrefix)) return false;
  return true;
}

/**
 * Generate a responsive `sizes` attribute for `<img>` / `<Image>` tags.
 * Pure utility — kept here for backwards-compatibility with the previous
 * stub.
 */
export function generateImageSizes(_url: string): string {
  return `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw`;
}
