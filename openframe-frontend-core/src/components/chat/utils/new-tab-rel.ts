/**
 * What a link opened in a new tab tells its destination. A destination on one of OUR platforms (named by the
 * composer's `targetPlatform`, or an href on a platform's own host, or a path of the current site) keeps the Referer:
 * HubSpot and PostHog attribute the cross-domain visit by it, and `noreferrer` turned every trial signup into direct
 * traffic. Anything else is a third party and also gets `noreferrer`. `noopener` always (tab-nabbing).
 *
 * THE one rule for a new tab, for an anchor's `rel` and for `window.open`'s features alike.
 */

import { getPlatformByHostname, isLocalUrl } from '../../../platform-domains';

export type NewTabRel = 'noopener' | 'noopener noreferrer';

/** True for a path with no scheme and no host (`/help-center/x`, `x`); false for `https://…` and `//…`. */
export function isRelativeHref(href: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href);
}

/** A path on this site (`/x`), or an absolute URL on a platform's own host (or a local one). Not a bare anchor
 *  (`#x`), a `mailto:` or any other scheme, and not a protocol-relative `//host`. */
function isOwnSiteHref(href: string | null | undefined): boolean {
  if (!href) return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const url = new URL(href);
    return isLocalUrl(url.href) || getPlatformByHostname(url.hostname) !== null;
  } catch {
    return false;
  }
}

export function newTabRel(href: string | null | undefined, targetPlatform?: string | null): NewTabRel {
  return targetPlatform || isOwnSiteHref(href) ? 'noopener' : 'noopener noreferrer';
}

/** {@link newTabRel} in `window.open` features syntax (comma-separated). */
export function newTabFeatures(href: string | null | undefined, targetPlatform?: string | null): string {
  return newTabRel(href, targetPlatform).replace(' ', ',');
}
