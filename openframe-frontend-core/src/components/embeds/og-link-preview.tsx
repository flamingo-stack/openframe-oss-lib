'use client';

import type React from 'react';
import { useState, useEffect, Component, type ReactNode } from 'react';
import Image from '../../embed-shims/next-image';
import Link from '../../embed-shims/next-link';
import { useImageEdgeColor } from '../../hooks';
import { useOgPlaceholderUrl } from '../../hooks/use-og-placeholder-url';
import { ICON_SIZE, MEDIA_ASPECT, TILE_SIZE } from '../../styles/component-sizes';
import { cn } from '../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';
import { TruncateText } from '../ui/truncate-text';

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
  /** CURATED title — our own copy for this link (e.g. a CMS-managed press
   *  row). Wins over the scrape; see the precedence rule on the component. */
  curatedTitle?: string;
  /** CURATED description. Wins over the scrape. */
  curatedDescription?: string;
  /** CURATED cover image. Wins over the scrape — an outlet's og:image is a
   *  fallback for links we have no cover for, never an override of one we
   *  deliberately chose. */
  curatedImage?: string;
  /** Publication / source name shown alongside the favicon (e.g. "TechCrunch"). */
  publicationName?: string;
  /** Publication logo URL shown alongside the title (defaults to favicon). */
  publicationLogo?: string;
  /** Card variant. `compact` = horizontal layout (~120px tall) suited for
   *  in-doc placements; `default` = larger vertical layout for press / hero
   *  positions; `tile` = a text-first press tile (favicon, outlet and `meta`,
   *  `kicker`, headline, excerpt) drawn from the props alone, with NO image and
   *  NO scrape, for uniform press walls where outlet imagery is unreliable. */
  variant?: 'default' | 'compact' | 'tile';
  /** The runtime's og-placeholder image (`useOgPlaceholderUrl`) when no image
   *  resolves. Default true; the markdown renderer turns it off to keep doc
   *  cards lighter. */
  enablePlaceholder?: boolean;
  /** Extra footer-line content (a date, a topic tag) after the site name, on
   *  the `default` and `tile` cards: the sanctioned way to add caller text. */
  meta?: ReactNode;
  /** A one-line label ABOVE the `tile` headline that says WHY the item is shown
   *  (e.g. a news theme). */
  kicker?: ReactNode;
}

const lineClamp = (lines: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
});

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

/** The cards' layout, read by the cards and by their skeleton, so the skeleton is the card's size. */
const COMPACT_OUTER_CLASS = 'my-4';
const COMPACT_FRAME_CLASS = 'flex h-[120px] flex-row overflow-hidden rounded-lg border border-ods-border bg-ods-card';
const COMPACT_MEDIA_CLASS = 'h-full w-[200px] flex-shrink-0';
const COMPACT_BODY_CLASS = 'flex min-w-0 flex-1 flex-col justify-center p-3';
/** The compact card with no image: one row of a favicon box, the title and description lines, the link mark. */
const COMPACT_ROW_CLASS =
  'flex flex-row items-center gap-3 overflow-hidden rounded-lg border border-ods-border bg-ods-card px-4 py-3';
const COMPACT_ICON_BOX_CLASS = `flex ${TILE_SIZE.sm} flex-shrink-0 items-center justify-center rounded-lg bg-ods-bg-surface`;
/** The no-image compact row's favicon, read by the row and by its skeleton. */
const COMPACT_FAVICON_CLASS = 'w-5 h-5';
/** The default card's publication logo beside the title, read by the card and by its skeleton. */
const DEFAULT_LOGO_CLASS = `mt-0.5 ${ICON_SIZE.lg} flex-shrink-0 rounded`;
const COMPACT_ROW_TEXT_CLASS = 'min-w-0 flex-1';
const COMPACT_ROW_LINE_CLASS = 'truncate text-h6';
const DEFAULT_OUTER_CLASS = 'my-6 flex flex-1 flex-col';
const DEFAULT_FRAME_CLASS = 'flex flex-1 flex-col overflow-hidden rounded-lg border border-ods-border bg-ods-card';
const DEFAULT_MEDIA_CLASS = `${MEDIA_ASPECT.video} w-full flex-none rounded-lg`;
const DEFAULT_BODY_CLASS = 'flex-1 p-4';
const DEFAULT_ROW_CLASS = 'flex items-start gap-3';

/**
 * A link preview while its page is scraped (or drawn in a loading scope): the `compact` (120px row) or `default`
 * (16:9 hero) card's frame, the media box, and bars for the title, description and source line.
 */
function OGLinkPreviewSkeleton({
  variant = 'default',
  image = true,
}: {
  variant?: 'compact' | 'default';
  /** `false`: the compact card's no-image row (a curated title with no curated image). */
  image?: boolean;
}) {
  if (variant === 'compact' && !image)
    return (
      <div className={COMPACT_OUTER_CLASS} aria-hidden>
        <div className={COMPACT_ROW_CLASS}>
          <div className={COMPACT_ICON_BOX_CLASS}>
            <UnifiedSkeleton className={cn(COMPACT_FAVICON_CLASS, 'rounded')} />
          </div>
          <div className={COMPACT_ROW_TEXT_CLASS}>
            <p className={COMPACT_ROW_LINE_CLASS}>
              <TextLineSkeleton type="inherit" as="span" className="w-2/3" />
            </p>
            <p className={COMPACT_ROW_LINE_CLASS}>
              <TextLineSkeleton type="inherit" as="span" className="w-1/2" />
            </p>
          </div>
          <ExternalLinkIcon size={14} />
        </div>
      </div>
    );
  if (variant === 'compact')
    return (
      <div className={COMPACT_OUTER_CLASS} aria-hidden>
        <div className={COMPACT_FRAME_CLASS}>
          <UnifiedSkeleton className={cn(COMPACT_MEDIA_CLASS, 'rounded-lg')} />
          <div className={COMPACT_BODY_CLASS}>
            {/* The tile's own lines: a one-line `text-h6` title, a two-line description, the source line. */}
            <TextLineSkeleton type="h6" className="w-3/4" />
            <TextLineSkeleton type="h6" lines={2} className="mt-1 w-full" />
            <TextLineSkeleton type="h6" className="mt-1 w-1/3" />
          </div>
        </div>
      </div>
    );
  return (
    <div className={DEFAULT_OUTER_CLASS} aria-hidden>
      <div className={DEFAULT_FRAME_CLASS}>
        <UnifiedSkeleton className={DEFAULT_MEDIA_CLASS} />
        <div className={DEFAULT_BODY_CLASS}>
          <div className={DEFAULT_ROW_CLASS}>
            <UnifiedSkeleton className={DEFAULT_LOGO_CLASS} />
            <div className="min-w-0 flex-1">
              {/* The title and the description each reserve two `text-h4` lines (the loaded `TruncateText`s). */}
              <TextLineSkeleton type="h4" lines={2} className="mb-2 w-full" />
              <TextLineSkeleton type="h4" lines={2} className="mb-2 w-5/6" />
              {/* The source line: the site name and the domain, at the line's own type. */}
              <div className="flex min-h-[var(--font-line-space-h4-body)] items-center gap-2 text-h6">
                <TextLineSkeleton type="inherit" as="span" className="w-24" />
                <TextLineSkeleton type="inherit" as="span" className="w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The `tile` card while its list loads: the tile's exact geometry (the `p-3`
 * card, the source row with a favicon dot, two headline lines, the excerpt
 * line), owned here so the tile and its loading state cannot drift apart.
 */
/** The tile's layout, read by the tile and by its skeleton. */
const TILE_FRAME_CLASS = 'flex min-w-0 flex-col gap-1.5 rounded-lg border border-ods-border bg-ods-card p-3';
const TILE_SOURCE_ROW_CLASS = 'flex min-w-0 items-center gap-1.5 text-h6';
/** The headline's and the excerpt's type (the loaded `TruncateText`s take them as their `variant`). */
const TILE_HEADLINE_CLASS = 'text-h3';
const TILE_EXCERPT_CLASS = 'text-h6';

function OGLinkTileSkeleton() {
  return (
    <div className={TILE_FRAME_CLASS} aria-hidden>
      <div className={TILE_SOURCE_ROW_CLASS}>
        <UnifiedSkeleton className="h-4 w-4 flex-shrink-0 rounded" />
        <TextLineSkeleton type="inherit" as="span" className="w-20" />
        <TextLineSkeleton type="inherit" as="span" className="ml-auto w-9" />
      </div>
      <div className={TILE_HEADLINE_CLASS}>
        <TextLineSkeleton type="inherit" lines={2} className="w-full" />
      </div>
      <div className={TILE_EXCERPT_CLASS}>
        <TextLineSkeleton type="inherit" className="w-5/6" />
      </div>
    </div>
  );
}

/**
 * Rich Open-Graph link preview card with skeleton, fallback, and image-edge
 * background detection.
 *
 * Flow:
 *  1. Validate URL early (no network for malformed input, localhost, or
 *     RFC1918 ranges — those render as plain `<a>` tags).
 *  2. `GET ogEndpointPath?url=<encoded>` — embedder serves the shape declared
 *     in `OGData`.
 *  3. Resolve the image by the PRECEDENCE rule below.
 *  4. Extract a letterbox background color from the resolved image via
 *     `useImageEdgeColor`. Same-origin proxy is REQUIRED for cross-origin
 *     images so the `<canvas>` extraction doesn't taint.
 *  5. Render compact (h-[120px] horizontal) or default (vertical w/ aspect-video
 *     hero) variant, with image-less degraded variants for each.
 *
 * PRECEDENCE — curated over scraped, for EVERY field alike. A `curated*` prop
 * is a value we chose ourselves; the scrape only fills what curation left
 * empty:
 *
 *     curatedImage → scraped og:image → scraped originalImage → placeholder
 *
 * The image chain used to invert this — any outlet og:image beat an uploaded
 * cover — so a deliberate editorial choice was silently overridden wherever
 * the outlet happened to publish one, while title and description read
 * curated-first 200 lines down. The chain is now expressed ONCE, as
 * `imageCandidates`, and `handleImageError` retires the candidate currently on
 * screen instead of restating the order: a positional error handler is how the
 * two halves drift apart.
 */
export const OGLinkPreview: React.FC<OGLinkPreviewProps> = ({
  url,
  apiBaseUrl,
  ogEndpointPath = '/api/og-scraper',
  curatedTitle,
  curatedDescription,
  curatedImage,
  publicationName,
  publicationLogo,
  variant = 'default',
  enablePlaceholder = true,
  meta,
  kicker,
}) => {
  const [ogData, setOgData] = useState<OGData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** URLs that failed to load. Keyed by url, so the candidate order below is
   *  the single owner of precedence. */
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(new Set());

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

  const isTile = variant === 'tile';
  // In a loading scope the preview is not scraped: it stays its own loading state.
  const held = useLoadingScope();

  useEffect(() => {
    // A tile is drawn from its props alone: no scrape.
    if (!isValidUrl || isLocalhost || isTile || held) return undefined;

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
  }, [url, isValidUrl, isLocalhost, isTile, held, apiBaseUrl, ogEndpointPath]);

  const isCompact = variant === 'compact';
  const domain = getDomain(url);

  // When the scrape fails, the card is built from the props, so one render
  // path serves both. The same props-built card also paints IMMEDIATELY while
  // the scrape is in flight whenever the caller curated a title: the card is at
  // its final size from the first paint and the scrape only refines it, so a
  // slow scrape cannot hold one card of a row in a skeleton and then jump the
  // row's height. The skeleton is only for a caller with nothing but a URL.
  const effectiveData: OGData | null =
    ogData ??
    (error || (loading && curatedTitle)
      ? {
          title: curatedTitle || domainToTitle(domain),
          description: curatedDescription || domain,
          image: '',
          url,
          siteName: publicationName || domain,
          type: 'website',
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        }
      : null);

  // The runtime's branded placeholder, last in the image chain below.
  const placeholderImageUrl = useOgPlaceholderUrl({
    title: effectiveData?.title,
    siteName: effectiveData?.siteName || domain,
    enabled: enablePlaceholder && !isTile,
  });

  // THE precedence rule, in one place (see the component doc). Each candidate
  // carries its SLOT, so the winner is identified by where it came from and
  // never by string-comparing the resolved url back against the inputs: two
  // slots can legitimately hold the same url (an embedder passing the outlet's
  // own image as `curatedImage`), and `===` would then pick the render branch
  // by coincidence.
  const imageCandidates: { source: 'curated' | 'og' | 'og-original' | 'placeholder'; url?: string | null }[] = [
    { source: 'curated', url: curatedImage },
    { source: 'og', url: effectiveData?.image },
    { source: 'og-original', url: effectiveData?.originalImage },
    { source: 'placeholder', url: placeholderImageUrl },
  ];
  const resolvedImage = imageCandidates.find(c => !!c.url && !failedImages.has(c.url)) ?? null;
  const resolvedImageUrl = resolvedImage?.url ?? null;

  const hasImage = !!resolvedImageUrl;
  const isCuratedImage = resolvedImage?.source === 'curated';
  const isPlaceholder = resolvedImage?.source === 'placeholder';
  const bgColor = useImageEdgeColor(resolvedImageUrl ?? null, 'var(--color-bg-surface)');

  const renderSkeleton = () => (
    <OGLinkPreviewSkeleton
      variant={isCompact ? 'compact' : 'default'}
      // A curated title with no curated image paints the no-image row while the scrape refines it.
      image={!(curatedTitle && !curatedImage)}
    />
  );

  // In a loading scope the card is its skeleton (a tile: the tile's own).
  if (held) return isTile ? <OGLinkTileSkeleton /> : renderSkeleton();

  if (isTile) {
    const name = publicationName || domainToTitle(domain);
    return (
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(TILE_FRAME_CLASS, 'group transition-colors hover:border-ods-accent')}
      >
        <div className={TILE_SOURCE_ROW_CLASS}>
          <Favicon src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} size="w-4 h-4" />
          <TruncateText as="span" variant="h6" className="text-current">
            {name}
          </TruncateText>
          {meta != null && (
            <span className="ml-auto flex flex-none items-center gap-1.5 text-ods-text-secondary">{meta}</span>
          )}
        </div>
        {kicker != null && (
          <div className="overflow-hidden text-ods-accent text-h5" style={lineClamp(1)}>
            {kicker}
          </div>
        )}
        <TruncateText
          lines={2}
          variant="h3"
          className="transition-colors group-hover:text-ods-accent"
          triggerClassName="-mt-0.5"
        >
          {curatedTitle || domainToTitle(domain)}
        </TruncateText>
        {curatedDescription && (
          <TruncateText lines={2} variant="h6" tone="secondary">
            {curatedDescription}
          </TruncateText>
        )}
      </Link>
    );
  }

  if (!url || typeof url !== 'string' || !isValidUrl) return renderSkeleton();

  if (isLocalhost) {
    return (
      <div className="my-6">
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-ods-accent transition-colors hover:text-ods-accent-hover"
        >
          <span className="underline">{url}</span>
          <ExternalLinkIcon size={14} />
        </Link>
      </div>
    );
  }

  // A skeleton only when there is no props-built card to paint (see `effectiveData`).
  if (!effectiveData) return renderSkeleton();

  const title = curatedTitle || effectiveData.title;
  // Empty string when the scrape returned nothing — descriptions render
  // conditionally below. Avoids the legacy `'No description available'` filler
  // that signaled "broken card" to users.
  const description = curatedDescription || effectiveData.description || '';
  const ogDomain = getDomain(effectiveData.url);
  const faviconSrc = effectiveData.favicon || `https://www.google.com/s2/favicons?domain=${ogDomain}&sz=32`;
  const logoSrc = publicationLogo || faviconSrc;

  // Retire whichever candidate is on screen; the next one down the chain
  // takes over on the re-render. Never restate the order here.
  const handleImageError = () => {
    const failed = resolvedImageUrl;
    if (!failed) return;
    setFailedImages(prev => (prev.has(failed) ? prev : new Set(prev).add(failed)));
  };

  const renderImage = () => {
    if (!resolvedImageUrl) return null;
    if (isPlaceholder) {
      return (
        <Image src={resolvedImageUrl} alt={title} className="rounded-md object-cover" fill sizes="100vw" unoptimized />
      );
    }
    if (isCuratedImage) {
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
        <div className={COMPACT_OUTER_CLASS}>
          <Link
            href={effectiveData.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(COMPACT_ROW_CLASS, 'group transition-all duration-200 hover:border-ods-accent')}
          >
            <div className={COMPACT_ICON_BOX_CLASS}>
              <Favicon src={faviconSrc} size={COMPACT_FAVICON_CLASS} />
            </div>
            <div className={COMPACT_ROW_TEXT_CLASS}>
              <h3 className="truncate font-semibold text-ods-text-primary transition-colors text-h6 group-hover:text-ods-accent">
                {title}
              </h3>
              {description && <p className="truncate text-ods-text-secondary text-h6">{description}</p>}
            </div>
            <ExternalLinkIcon size={14} />
          </Link>
        </div>
      );
    }
    return (
      <div className="my-4">
        <Link
          href={effectiveData.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(COMPACT_FRAME_CLASS, 'group transition-colors hover:border-ods-accent')}
        >
          <div
            className={cn(
              COMPACT_MEDIA_CLASS,
              'relative flex items-center justify-center overflow-hidden rounded-lg transition-colors duration-300',
            )}
            style={{ backgroundColor: bgColor }}
          >
            {renderImage()}
          </div>
          <div className={COMPACT_BODY_CLASS}>
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
        </Link>
      </div>
    );
  }

  if (!hasImage) {
    return (
      <div className="my-6 flex flex-1 flex-col">
        <Link
          href={effectiveData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-1 items-center gap-3 overflow-hidden rounded-lg border border-ods-border bg-ods-card px-4 py-3 transition-all duration-200 hover:border-ods-accent"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ods-bg-surface">
            <Favicon src={faviconSrc} />
          </div>
          <div className="min-w-0 flex-1">
            <TruncateText className="font-semibold transition-colors group-hover:text-ods-accent">{title}</TruncateText>
            {description && <TruncateText tone="secondary">{description}</TruncateText>}
          </div>
          <ExternalLinkIcon />
        </Link>
      </div>
    );
  }

  return (
    // `flex-1` lets the card stretch when the caller places it in a flex column
    // inside a stretching grid (equal row heights); inert in block flow.
    <div className={DEFAULT_OUTER_CLASS}>
      <Link
        href={effectiveData.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(DEFAULT_FRAME_CLASS, 'group transition-colors hover:border-ods-accent')}
      >
        <div
          className={cn(
            DEFAULT_MEDIA_CLASS,
            'relative flex items-center justify-center overflow-hidden transition-colors duration-300',
          )}
          style={{ backgroundColor: bgColor }}
        >
          {renderImage()}
        </div>
        <div className={DEFAULT_BODY_CLASS}>
          <div className={DEFAULT_ROW_CLASS}>
            <Image
              src={logoSrc}
              alt={publicationName || ''}
              className={cn(DEFAULT_LOGO_CLASS, 'object-contain')}
              width={24}
              height={24}
              unoptimized
              onError={e => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
              }}
            />
            <div className="min-w-0 flex-1">
              {/* Title and description each RESERVE two h4 lines, so every card in a
                  grid is one height, and the clamp shows two whole lines. */}
              <TruncateText
                lines={2}
                className="min-h-[calc(var(--font-line-space-h4-body)*2)] font-semibold transition-colors group-hover:text-ods-accent"
                triggerClassName="mb-2"
              >
                {title}
              </TruncateText>
              <TruncateText
                lines={2}
                tone="secondary"
                className="min-h-[calc(var(--font-line-space-h4-body)*2)]"
                triggerClassName="mb-2"
              >
                {description}
              </TruncateText>
              <div className="flex min-w-0 items-center gap-2 text-ods-text-secondary text-h6">
                <TruncateText as="span" variant="h6" className="text-current">
                  {effectiveData.siteName}
                </TruncateText>
                <span>•</span>
                <TruncateText as="span" variant="h6" className="text-current">
                  {ogDomain}
                </TruncateText>
                {meta}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};
