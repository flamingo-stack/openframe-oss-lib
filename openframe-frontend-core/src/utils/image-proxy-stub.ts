/**
 * Utility functions for handling image proxy URLs
 */

import { getProxiedImageUrl as getProxiedImageUrlImpl, shouldProxyImage as shouldProxyImageImpl } from './image-proxy';

/**
 * Get proxied image URL for external images
 * If it's an external HTTP/HTTPS URL, proxy it through our API
 * Otherwise, return the original URL
 *
 * @deprecated This is a thin wrapper delegating to image-proxy.ts, preserved
 * for existing call sites that still import from this module. Prefer
 * importing getProxiedImageUrl from './image-proxy' directly.
 */
export function getProxiedImageUrl(imageUrl: string | null): string | null {
  return getProxiedImageUrlImpl(imageUrl, {
    proxyPrefix: '/api/image-proxy',
    skipDomains: ['openmsp.ai'],
  });
}

/**
 * Check if an image URL needs to be proxied
 *
 * @deprecated This is a thin wrapper delegating to image-proxy.ts, preserved
 * for existing call sites that still import from this module. Prefer
 * importing shouldProxyImage from './image-proxy' directly.
 */
export function shouldProxyImage(imageUrl: string | null): boolean {
  return shouldProxyImageImpl(imageUrl, {
    proxyPrefix: '/api/image-proxy',
  });
}
