/**
 * Utility functions for handling image proxy URLs
 *
 * @deprecated This stub duplicates the newer, parameterized image-proxy.ts
 * utility, which replaces the hub's hardcoded '/api/image-proxy' prefix and
 * 'openmsp.ai' skip-domain check with caller-supplied parameters. Prefer
 * importing from './image-proxy' instead of this file. This stub is kept
 * only for backward compatibility with existing call sites and delegates to
 * the newer utility to avoid divergent behavior.
 */

import { getProxiedImageUrl as getProxiedImageUrlConfigurable, shouldProxyImage as shouldProxyImageConfigurable } from './image-proxy';

/**
 * Get proxied image URL for external images
 * If it's an external HTTP/HTTPS URL, proxy it through our API
 * Otherwise, return the original URL
 *
 * @deprecated Use getProxiedImageUrl from './image-proxy' with explicit
 * proxyPrefix and skipDomains parameters instead.
 */
export function getProxiedImageUrl(imageUrl: string | null): string | null {
  return getProxiedImageUrlConfigurable(imageUrl, '/api/image-proxy', ['openmsp.ai']);
}

/**
 * Check if an image URL needs to be proxied
 *
 * @deprecated Use shouldProxyImage from './image-proxy' instead.
 */
export function shouldProxyImage(imageUrl: string | null): boolean {
  return shouldProxyImageConfigurable(imageUrl, '/api/image-proxy');
}
