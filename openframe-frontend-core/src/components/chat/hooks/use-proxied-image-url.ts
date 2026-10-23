'use client';

import { useChatRuntime } from '../../../contexts/chat-runtime-context';
import { getProxiedImageUrl } from '../../../utils/image-proxy';

export interface UseProxiedImageUrlOptions {
  /** A host-injected mapper. When given it wins over the ambient runtime (a host that resolves its own images). */
  proxyImageUrl?: (url: string) => string;
  /**
   * Load an `https://` image directly instead of through the proxy. Default `true` (the proxy is for `http://` and
   * hosts that refuse a cross-origin request); pass `false` for an image that must go through the proxy.
   */
  directHttps?: boolean;
}

/**
 * THE way a component resolves an image URL through the image proxy: every avatar, logo and cover in the lib and its
 * hosts reads it here, never by calling `getProxiedImageUrl` with the runtime's endpoints by hand.
 *
 * Order: the host's `proxyImageUrl` → the ambient `ChatRuntime`'s `imageProxyUrlPrefix` / `imageProxySkipDomains` →
 * the URL as it is (a bare embed with no runtime loads images directly). Returns `''` for no URL, so a caller writes
 * `const src = useProxiedImageUrl(url); src ? <Image src={src}/> : <Initials/>`.
 *
 * Rules of hooks: call at the top of a component, never inside a loop. A list of images is a list of components, each
 * calling it for its own row; a server or non-React caller uses the pure `getProxiedImageUrl`.
 */
export function useProxiedImageUrl(url: string | null | undefined, options?: UseProxiedImageUrlOptions): string {
  const runtime = useChatRuntime();
  if (!url) return '';
  if (options?.proxyImageUrl) return options.proxyImageUrl(url);
  return (
    getProxiedImageUrl(url, {
      proxyPrefix: runtime?.endpoints.imageProxyUrlPrefix,
      skipDomains: runtime?.endpoints.imageProxySkipDomains,
      directHttps: options?.directHttps ?? true,
    }) ?? url
  );
}
