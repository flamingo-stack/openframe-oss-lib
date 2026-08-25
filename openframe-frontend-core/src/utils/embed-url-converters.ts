/**
 * Shared utilities for converting external service URLs to embeddable formats.
 * Used by lib's embed components and the hub's admin document editor.
 */

export function toGoogleSheetsEmbedUrl(url: string): string {
  if (url.includes('/htmlembed')) return url;

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return url;

  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${match[1]}/htmlembed?widget=true&chrome=false&headers=false&gid=${gid}`;
}

export function toGoogleSheetsOriginalUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return url;

  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${match[1]}/edit#gid=${gid}`;
}

/**
 * Convert a Figma URL to an embeddable URL.
 * Slides/deck URLs map to `deck` (present) by default; `slidesView: 'browse'` switches to `slides` (browse).
 */
export function toFigmaEmbedUrl(url: string, opts?: { slidesView?: 'present' | 'browse' }): string {
  if (url.includes('embed.figma.com')) return url;
  if (url.includes('figma.com/embed')) return url;

  const match = url.match(/figma\.com\/(design|file|proto|board|slides|deck)\/([a-zA-Z0-9]+)(?:\/([^?]*))?(\?.*)?$/);

  if (match) {
    const [, urlType, fileKey, titleSlug, queryString] = match;
    const isSlides = urlType === 'slides' || urlType === 'deck';
    const embedType =
      urlType === 'proto' ? 'proto' : isSlides ? (opts?.slidesView === 'browse' ? 'slides' : 'deck') : 'design';
    const pathSuffix = titleSlug ? `/${titleSlug}` : '';

    const params = new URLSearchParams(queryString?.replace(/^\?/, '') || '');
    if (!params.has('embed-host')) {
      params.set('embed-host', 'flamingo');
    }
    const clientId = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID;
    if (clientId && !params.has('client-id')) {
      params.set('client-id', clientId);
    }

    return `https://embed.figma.com/${embedType}/${fileKey}${pathSuffix}?${params.toString()}`;
  }

  return `https://www.figma.com/embed?embed-host=flamingo&url=${encodeURIComponent(url)}`;
}

export function isFigmaSlidesUrl(url: string): boolean {
  if (!url) return false;
  return /(?:www\.|embed\.)?figma\.com\/(?:slides|deck)\/[a-zA-Z0-9]+/.test(url);
}

export function toFigmaOriginalUrl(url: string): string {
  if (url.includes('embed.figma.com')) {
    return url.replace('embed.figma.com', 'www.figma.com').replace(/\?.*$/, '');
  }
  return url.replace(/\?.*$/, '');
}

/**
 * The EMBED url for a published Claude artifact, or `null` when the link is not
 * one we can frame — the Claude counterpart of `toFigmaEmbedUrl`.
 *
 * claude.ai serves `frame-ancestors 'self'` on the artifact page itself, but a
 * PUBLISHED artifact also has an `/embed` route whose `frame-ancestors` carries
 * the domains its author allow-listed under "Get embed code → Allowed domains".
 * That is Anthropic's supported way to put an artifact on another site, so that
 * is what the iframe points at.
 *
 * Returns `null` for everything else, including a Claude CODE url
 * (`claude.ai/code/artifact/…`), whose Share dialog exposes no Embed settings
 * and whose `/embed` path answers `frame-ancestors 'self'` (verified against
 * real artifacts, 2026-08). A trailing `/embed` is accepted because that is the
 * url "Get embed code" hands the author.
 */
export function toClaudeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // `claude.site/artifacts/<id>` 308-redirects to the claude.ai public url.
    const publicId =
      (host === 'claude.ai' && /^\/public\/artifacts\/([\w-]+)(?:\/embed)?\/?$/.exec(u.pathname)?.[1]) ||
      (host === 'claude.site' && /^\/artifacts\/([\w-]+)(?:\/embed)?\/?$/.exec(u.pathname)?.[1]) ||
      null;
    return publicId ? `https://claude.ai/public/artifacts/${publicId}/embed` : null;
  } catch {
    return null;
  }
}
