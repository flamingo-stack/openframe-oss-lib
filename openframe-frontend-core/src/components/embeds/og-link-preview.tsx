'use client';

import type React from 'react';
import { useState, useEffect, Component, type ReactNode } from 'react';
import Image from '../../embed-shims/next-image';
import { useImageEdgeColor } from '../../hooks';

/**
 * Open-Graph metadata returned by the consumer's scrape endpoint.
 *
 * The shape MUST match the JSON the OG endpoint serves at `ogEndpointPath`.
 * The hub's `/api/og-scraper` returns exactly these fields — embedders
 * with a different endpoint must return the same shape (or adapt at the
 * route boundary). Keeps the consumer surface trivial: one URL → one card.
 */
export interface OGData {
  title: string;
  description: string;
  image: string;
  originalImage?: string;
  url: string;
  siteName: string;
  type: string;
  favicon: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Tiny error boundary tailored for OG link previews — caught errors quietly
 * fall back to the `fallback` prop (typically a plain hyperlink) so a single
 * broken third-party preview can't crash a whole article view.
 *
 * Named `OGLinkErrorBoundary` (not the generic `ErrorBoundary`) because the
 * lib already exports a separate `ErrorBoundary` from
 * `components/features/error-boundary.tsx`. The top-level `components/index.ts`
 * barrel re-exports both `./embeds` and `./features` via `export *`, so a
 * second `ErrorBoundary` here collides as TS2308.
 */
export class OGLinkErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Link preview error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Builds a placeholder image URL when the scrape returns no image. Hub passes
 * its own `buildOgPlaceholderUrl` (which hits `/api/og-placeholder?…&platform=`;
 * the route resolves the platform's brand colors server-side); other embedders
 * can omit the prop to disable the placeholder entirely.
 *
 * Receives the post-scrape `title` and `siteName` so the placeholder can echo
 * the actual card content, not a generic graphic.
 */
export type BuildPlaceholderUrl = (title: string, siteName: string) => string | null;

export interface OGLinkPreviewProps {
  /** The external URL to preview. */
  url: string;
  /** Origin / base URL the OG endpoint is served from. Empty / undefined
   *  means same-origin (hub-direct use). Embed contexts pass the hub's
   *  origin here (e.g. `'https://hub.example.com'`) so the fetch hits
   *  the hub instead of the embedder origin.
   *
   *  Pattern matches lib's `useNatsDialogSubscription({apiBaseUrl})` +
   *  `buildSuggestionUrl({apiBaseUrl})` so all embed-ready surfaces share
   *  one configuration knob. */
  apiBaseUrl?: string;
  /** Path of the OG endpoint on the configured base. Default
   *  `'/api/og-scraper'` matches the hub's route. Override if the
   *  embedder serves the same `OGData` shape from a different path. */
  ogEndpointPath?: string;
  /** Optional placeholder-builder. Omit to disable the placeholder image
   *  (the card then degrades to a favicon+title chip when no scraped image
   *  is available). The hub injects its `buildOgPlaceholderUrl` here. */
  buildPlaceholderUrl?: BuildPlaceholderUrl;
  /** Override the scraped title (used by publication cards that already know
   *  the title locally — e.g. a CMS-managed press link). */
  fallbackTitle?: string;
  /** Override the scraped description. */
  fallbackDescription?: string;
  /** Override the scraped image — useful when the scrape returns no image but
   *  the embedder has a CMS-stored hero image to fall back to. */
  fallbackImage?: string;
  /** Publication / source name shown alongside the favicon (e.g. "TechCrunch"). */
  publicationName?: string;
  /** Publication logo URL shown alongside the title (defaults to favicon). */
  publicationLogo?: string;
  /** Card variant. `compact` = horizontal layout (~120px tall) suited for
   *  in-doc placements; `default` = larger vertical layout for press / hero
   *  positions. */
  variant?: 'default' | 'compact';
  /** Disable the synthesized placeholder image even when `buildPlaceholderUrl`
   *  is provided — used by the markdown renderer to keep doc cards lighter. */
  enablePlaceholder?: boolean;
}

function getDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace('www.', '');
  } catch {
    return 'External Link';
  }
}

function domainToTitle(domain: string): string {
  return domain
    .split('.')[0]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const ExternalLinkIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className="flex-shrink-0 text-ods-text-secondary transition-colors group-hover:text-ods-accent"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

const Favicon = ({ src, size = 'w-6 h-6' }: { src: string; size?: string }) => (
  <Image
    src={src}
    alt=""
    className={size}
    width={24}
    height={24}
    unoptimized
    onError={e => {
      const img = e.target as HTMLImageElement;
      img.style.display = 'none';
    }}
  />
);

/**
 * Rich Open-Graph link preview card with skeleton, fallback, and image-edge
 * background detection.
 *
 * Flow:
 *  1. Validate URL early (no network for malformed input, localhost, or
 *     RFC1918 ranges — those render as plain `<a>` tags).
 *  2. `GET ogEndpointPath?url=<encoded>` — embedder serves the shape declared
 *     in `OGData`.
 *  3. Resolve image: scraped og:image → `originalImage` fallback → `fallbackImage`
 *     prop → `buildPlaceholderUrl(title, siteName)`. Each step has its own
 *     error toggle so a 404 / CORS-tainted image gracefully degrades.
 *  4. Extract a letterbox background color from the resolved image via
 *     `useImageEdgeColor`. Same-origin proxy is REQUIRED for cross-origin
 *     images so the `<canvas>` extraction doesn't taint.
 *  5. Render compact (h-[120px] horizontal) or default (vertical w/ aspect-video
 *     hero) variant, with image-less degraded variants for each.
 */
export const OGLinkPreview: React.FC<OGLinkPreviewProps> = ({
  url,
  apiBaseUrl,
  ogEndpointPath = '/api/og-scraper',
  buildPlaceholderUrl,
  fallbackTitle,
  fallbackDescription,
  fallbackImage,
  publicationName,
  publicationLogo,
  variant = 'default',
  enablePlaceholder = true,
}) => {
  const [ogData, setOgData] = useState<OGData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [originalImageError, setOriginalImageError] = useState(false);
  const [fallbackImageError, setFallbackImageError] = useState(false);

  let isValidUrl = true;
  let isLocalhost = false;
  try {
    if (url && typeof url === 'string') {
      const urlObj = new URL(url);
      if (
        ['localhost', '127.0.0.1', '0.0.0.0'].includes(urlObj.hostname) ||
        urlObj.hostname.startsWith('192.168.') ||
        urlObj.hostname.startsWith('10.') ||
        urlObj.hostname.startsWith('172.')
      ) {
        isLocalhost = true;
      }
    } else {
      isValidUrl = false;
    }
  } catch {
    isValidUrl = false;
  }

  useEffect(() => {
    if (!isValidUrl || isLocalhost) return undefined;

    // A `url` change starts a second fetch while the first is still in flight.
    // Without this guard the SUPERSEDED response can land last and paint the
    // PREVIOUS link's title/image/favicon into this card — or flip it to the
    // fallback error card for a link that actually resolved fine.
    let cancelled = false;

    const fetchOGData = async () => {
      try {
        new URL(url);
        setLoading(true);
        // Compose `${base}${path}?url=…`. Empty base → relative path
        // (same-origin); absolute base → cross-origin embed against the hub.
        // Plain string concat is safer than `new URL(path, base)` because
        // the latter resolves `path` against the BASE's pathname when
        // `path` is relative, producing surprising URLs when the embedder
        // serves the lib from a subpath.
        const endpoint = `${apiBaseUrl ?? ''}${ogEndpointPath}?url=${encodeURIComponent(url)}`;
        const response = await fetch(endpoint);
        if (cancelled) return;
        if (response.ok) {
          // The endpoint is embedder-supplied, so treat every field as
          // optional and fill the gaps the way the error card does (empty
          // string = "nothing to render"). `OGData` promises non-optional
          // strings; without this a sparse payload broke that promise and the
          // image/favicon chain got `undefined` where it tests for falsy.
          const data = (await response.json()) as Partial<OGData> | null;
          if (cancelled) return;
          if (data?.title && data.title !== 'Link Preview Unavailable') {
            setOgData({
              title: data.title,
              description: data.description ?? '',
              image: data.image ?? '',
              originalImage: data.originalImage,
              url: data.url ?? url,
              siteName: data.siteName ?? '',
              type: data.type ?? 'website',
              favicon: data.favicon ?? '',
            });
          } else {
            setError(true);
          }
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Never rejects — try/catch/finally, every write gated on `cancelled`.
    void fetchOGData();

    return () => {
      cancelled = true;
    };
  }, [url, isValidUrl, isLocalhost, apiBaseUrl, ogEndpointPath]);

  const isCompact = variant === 'compact';
  const domain = getDomain(url);

  const effectiveData: OGData | null =
    ogData ??
    (error
      ? {
          title: fallbackTitle || domainToTitle(domain),
          description: fallbackDescription || domain,
          image: '',
          url,
          siteName: publicationName || domain,
          type: 'website',
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        }
      : null);

  // Hub-injected placeholder builder — fires only when the post-scrape image
  // chain is empty AND `enablePlaceholder` is true. `null` when unprovided.
  const placeholderImageUrl =
    enablePlaceholder && buildPlaceholderUrl && effectiveData?.title
      ? buildPlaceholderUrl(effectiveData.title, effectiveData.siteName || domain)
      : null;

  const resolvedImageUrl =
    effectiveData?.image && !imageError
      ? effectiveData.image
      : effectiveData?.originalImage && !originalImageError
        ? effectiveData.originalImage
        : fallbackImage && !fallbackImageError
          ? fallbackImage
          : placeholderImageUrl;

  const hasImage = !!resolvedImageUrl;
  const isFallbackImage = resolvedImageUrl === fallbackImage;
  const isPlaceholder = resolvedImageUrl === placeholderImageUrl && !isFallbackImage;
  const bgColor = useImageEdgeColor(resolvedImageUrl ?? null, 'var(--color-bg-surface)');

  const renderSkeleton = () =>
    isCompact ? (
      <div className="my-4">
        <div className="flex h-[120px] flex-row overflow-hidden rounded-lg border border-ods-border bg-ods-card">
          <div className="h-full w-[200px] flex-shrink-0 animate-pulse bg-ods-border" />
          <div className="flex flex-1 flex-col justify-center p-3">
            <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-ods-border" />
            <div className="mb-1 h-3 w-full animate-pulse rounded bg-ods-border" />
            <div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-ods-border" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-ods-border" />
          </div>
        </div>
      </div>
    ) : (
      <div className="my-6">
        <div className="block overflow-hidden rounded-lg border border-ods-border bg-ods-card">
          <div className="relative aspect-video w-full animate-pulse overflow-hidden bg-ods-border" />
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-6 w-6 flex-shrink-0 animate-pulse rounded bg-ods-border" />
              <div className="min-w-0 flex-1">
                <div className="mb-2 h-[2.5rem] overflow-hidden leading-[1.25rem]">
                  <div
                    className="animate-pulse rounded bg-ods-border"
                    style={{ height: '1.25rem', marginBottom: '0.25rem' }}
                  />
                  <div className="w-3/4 animate-pulse rounded bg-ods-border" style={{ height: '1.25rem' }} />
                </div>
                <div className="mb-2 h-[2.5rem] overflow-hidden leading-[1.25rem]">
                  <div
                    className="animate-pulse rounded bg-ods-border"
                    style={{ height: '1.25rem', marginBottom: '0.25rem' }}
                  />
                  <div className="w-5/6 animate-pulse rounded bg-ods-border" style={{ height: '1.25rem' }} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="animate-pulse rounded bg-ods-border" style={{ height: '0.75rem', width: '6rem' }} />
                  <div className="animate-pulse rounded bg-ods-border" style={{ height: '0.75rem', width: '5rem' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  if (!url || typeof url !== 'string' || !isValidUrl) return renderSkeleton();

  if (isLocalhost) {
    return (
      <div className="my-6">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-ods-accent transition-colors hover:text-ods-accent-hover"
        >
          <span className="underline">{url}</span>
          <ExternalLinkIcon size={14} />
        </a>
      </div>
    );
  }

  if (loading) return renderSkeleton();
  if (!effectiveData) return renderSkeleton();

  const title = fallbackTitle || effectiveData.title;
  // Empty string when the scrape returned nothing — descriptions render
  // conditionally below. Avoids the legacy `'No description available'` filler
  // that signaled "broken card" to users.
  const description = fallbackDescription || effectiveData.description || '';
  const ogDomain = getDomain(effectiveData.url);
  const faviconSrc = effectiveData.favicon || `https://www.google.com/s2/favicons?domain=${ogDomain}&sz=32`;
  const logoSrc = publicationLogo || faviconSrc;

  const handleImageError = () => {
    if (effectiveData.image && !imageError) setImageError(true);
    else if (effectiveData.originalImage && !originalImageError) setOriginalImageError(true);
    else setFallbackImageError(true);
  };

  const renderImage = () => {
    if (!resolvedImageUrl) return null;
    if (isPlaceholder) {
      return (
        <Image src={resolvedImageUrl} alt={title} className="rounded-md object-cover" fill sizes="100vw" unoptimized />
      );
    }
    if (isFallbackImage) {
      return (
        <Image
          src={resolvedImageUrl}
          alt={title}
          fill
          className="rounded-md object-contain transition-transform duration-300 group-hover:scale-105"
          onError={handleImageError}
          unoptimized={resolvedImageUrl.includes('/render/image/')}
        />
      );
    }
    return (
      <Image
        src={resolvedImageUrl}
        alt={title}
        className="rounded-md object-contain transition-transform duration-300 group-hover:scale-105"
        fill
        sizes="100vw"
        unoptimized
        onError={handleImageError}
      />
    );
  };

  if (isCompact) {
    if (!hasImage) {
      return (
        <div className="my-4">
          <a
            href={effectiveData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-row items-center gap-3 overflow-hidden rounded-lg border border-ods-border bg-ods-card px-4 py-3 transition-all duration-200 hover:border-ods-accent"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ods-bg-surface">
              <Favicon src={faviconSrc} size="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-ods-text-primary transition-colors text-h6 group-hover:text-ods-accent">
                {title}
              </h3>
              {description && <p className="truncate text-ods-text-secondary text-h6">{description}</p>}
            </div>
            <ExternalLinkIcon size={14} />
          </a>
        </div>
      );
    }
    return (
      <div className="my-4">
        <a
          href={effectiveData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex h-[120px] flex-row overflow-hidden rounded-lg border border-ods-border bg-ods-card transition-colors hover:border-ods-accent"
        >
          <div
            className="relative flex h-full w-[200px] flex-shrink-0 items-center justify-center overflow-hidden rounded-lg transition-colors duration-300"
            style={{ backgroundColor: bgColor }}
          >
            {renderImage()}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
            <h3
              className="overflow-hidden font-semibold text-ods-text-primary transition-colors text-h6 group-hover:text-ods-accent"
              style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}
            >
              {title}
            </h3>
            {description && (
              <p
                className="mt-1 overflow-hidden text-ods-text-secondary text-h6"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              >
                {description}
              </p>
            )}
            <div className="mt-1 truncate text-ods-text-secondary text-h6">{effectiveData.siteName || ogDomain}</div>
          </div>
        </a>
      </div>
    );
  }

  if (!hasImage) {
    return (
      <div className="my-6">
        <a
          href={effectiveData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 overflow-hidden rounded-lg border border-ods-border bg-ods-card px-4 py-3 transition-all duration-200 hover:border-ods-accent"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ods-bg-surface">
            <Favicon src={faviconSrc} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-ods-text-primary transition-colors text-h6 group-hover:text-ods-accent">
              {title}
            </h3>
            {description && <p className="truncate text-ods-text-secondary text-h6">{description}</p>}
          </div>
          <ExternalLinkIcon />
        </a>
      </div>
    );
  }

  return (
    <div className="my-6">
      <a
        href={effectiveData.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-lg border border-ods-border bg-ods-card transition-colors hover:border-ods-accent"
      >
        <div
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg transition-colors duration-300"
          style={{ backgroundColor: bgColor }}
        >
          {renderImage()}
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Image
              src={logoSrc}
              alt={publicationName || ''}
              className="mt-0.5 h-6 w-6 flex-shrink-0 rounded object-contain"
              width={24}
              height={24}
              unoptimized
              onError={e => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
              }}
            />
            <div className="min-w-0 flex-1">
              <h3
                className="mb-2 h-[2.5rem] overflow-hidden font-semibold text-ods-text-primary transition-colors text-h6 group-hover:text-ods-accent"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              >
                {title}
              </h3>
              {description && (
                <p
                  className="mb-2 h-[2.5rem] overflow-hidden text-ods-text-secondary text-h6"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {description}
                </p>
              )}
              <div className="flex items-center gap-2 text-ods-text-secondary text-h6">
                <span>{effectiveData.siteName}</span>
                <span>•</span>
                <span className="truncate">{ogDomain}</span>
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};
