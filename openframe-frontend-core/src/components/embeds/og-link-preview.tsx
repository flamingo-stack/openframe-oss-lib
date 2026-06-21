"use client"

import React, { useState, useEffect, Component, ReactNode } from 'react'
import Image from '../../embed-shims/next-image'
import { useImageEdgeColor } from '../../hooks'

/**
 * Open-Graph metadata returned by the consumer's scrape endpoint.
 *
 * The shape MUST match the JSON the OG endpoint serves at `ogEndpointPath`.
 * The hub's `/api/blog/og-scraper` returns exactly these fields — embedders
 * with a different endpoint must return the same shape (or adapt at the
 * route boundary). Keeps the consumer surface trivial: one URL → one card.
 */
export interface OGData {
  title: string
  description: string
  image: string
  originalImage?: string
  url: string
  siteName: string
  type: string
  favicon: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
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
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Link preview error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

/**
 * Builds a placeholder image URL when the scrape returns no image. Hub passes
 * its own `buildOgPlaceholderUrl` (which resolves CSS-var ODS colors against
 * the platform's brand palette + hits `/api/og-placeholder`); other embedders
 * can omit the prop to disable the placeholder entirely.
 *
 * Receives the post-scrape `title` and `siteName` so the placeholder can echo
 * the actual card content, not a generic graphic.
 */
export type BuildPlaceholderUrl = (
  title: string,
  siteName: string,
) => string | null

export interface OGLinkPreviewProps {
  /** The external URL to preview. */
  url: string
  /** Origin / base URL the OG endpoint is served from. Empty / undefined
   *  means same-origin (hub-direct use). Embed contexts pass the hub's
   *  origin here (e.g. `'https://hub.example.com'`) so the fetch hits
   *  the hub instead of the embedder origin.
   *
   *  Pattern matches lib's `useNatsDialogSubscription({apiBaseUrl})` +
   *  `buildSuggestionUrl({apiBaseUrl})` so all embed-ready surfaces share
   *  one configuration knob. */
  apiBaseUrl?: string
  /** Path of the OG endpoint on the configured base. Default
   *  `'/api/blog/og-scraper'` matches the hub's route. Override if the
   *  embedder serves the same `OGData` shape from a different path. */
  ogEndpointPath?: string
  /** Optional placeholder-builder. Omit to disable the placeholder image
   *  (the card then degrades to a favicon+title chip when no scraped image
   *  is available). The hub injects its `buildOgPlaceholderUrl` here. */
  buildPlaceholderUrl?: BuildPlaceholderUrl
  /** Override the scraped title (used by publication cards that already know
   *  the title locally — e.g. a CMS-managed press link). */
  fallbackTitle?: string
  /** Override the scraped description. */
  fallbackDescription?: string
  /** Override the scraped image — useful when the scrape returns no image but
   *  the embedder has a CMS-stored hero image to fall back to. */
  fallbackImage?: string
  /** Publication / source name shown alongside the favicon (e.g. "TechCrunch"). */
  publicationName?: string
  /** Publication logo URL shown alongside the title (defaults to favicon). */
  publicationLogo?: string
  /** Card variant. `compact` = horizontal layout (~120px tall) suited for
   *  in-doc placements; `default` = larger vertical layout for press / hero
   *  positions. */
  variant?: 'default' | 'compact'
  /** Disable the synthesized placeholder image even when `buildPlaceholderUrl`
   *  is provided — used by the markdown renderer to keep doc cards lighter. */
  enablePlaceholder?: boolean
}

function getDomain(urlStr: string): string {
  try { return new URL(urlStr).hostname.replace('www.', '') }
  catch { return 'External Link' }
}

function domainToTitle(domain: string): string {
  return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const ExternalLinkIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-ods-text-secondary group-hover:text-ods-accent transition-colors flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
)

const Favicon = ({ src, size = 'w-6 h-6' }: { src: string; size?: string }) => (
  <img src={src} alt="" className={size} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
)

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
  ogEndpointPath = '/api/blog/og-scraper',
  buildPlaceholderUrl,
  fallbackTitle,
  fallbackDescription,
  fallbackImage,
  publicationName,
  publicationLogo,
  variant = 'default',
  enablePlaceholder = true,
}) => {
  const [ogData, setOgData] = useState<OGData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [originalImageError, setOriginalImageError] = useState(false)
  const [fallbackImageError, setFallbackImageError] = useState(false)

  let isValidUrl = true
  let isLocalhost = false
  try {
    if (url && typeof url === 'string') {
      const urlObj = new URL(url)
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(urlObj.hostname) ||
          urlObj.hostname.startsWith('192.168.') || urlObj.hostname.startsWith('10.') || urlObj.hostname.startsWith('172.')) {
        isLocalhost = true
      }
    } else {
      isValidUrl = false
    }
  } catch {
    isValidUrl = false
  }

  useEffect(() => {
    if (!isValidUrl || isLocalhost) return

    const fetchOGData = async () => {
      try {
        new URL(url)
        setLoading(true)
        // Compose `${base}${path}?url=…`. Empty base → relative path
        // (same-origin); absolute base → cross-origin embed against the hub.
        // Plain string concat is safer than `new URL(path, base)` because
        // the latter resolves `path` against the BASE's pathname when
        // `path` is relative, producing surprising URLs when the embedder
        // serves the lib from a subpath.
        const endpoint = `${apiBaseUrl ?? ''}${ogEndpointPath}?url=${encodeURIComponent(url)}`
        const response = await fetch(endpoint)
        if (response.ok) {
          const data = await response.json()
          if (data?.title && data.title !== 'Link Preview Unavailable') {
            setOgData(data)
          } else {
            setError(true)
          }
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchOGData()
  }, [url, isValidUrl, isLocalhost, apiBaseUrl, ogEndpointPath])

  const isCompact = variant === 'compact'
  const domain = getDomain(url)

  const effectiveData: OGData | null = ogData ?? (error ? {
    title: fallbackTitle || domainToTitle(domain),
    description: fallbackDescription || domain,
    image: '',
    url,
    siteName: publicationName || domain,
    type: 'website',
    favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
  } : null)

  // Hub-injected placeholder builder — fires only when the post-scrape image
  // chain is empty AND `enablePlaceholder` is true. `null` when unprovided.
  const placeholderImageUrl =
    enablePlaceholder && buildPlaceholderUrl && effectiveData?.title
      ? buildPlaceholderUrl(effectiveData.title, effectiveData.siteName || domain)
      : null

  const resolvedImageUrl = (effectiveData?.image && !imageError)
    ? effectiveData.image
    : (effectiveData?.originalImage && !originalImageError)
      ? effectiveData.originalImage
      : (fallbackImage && !fallbackImageError)
        ? fallbackImage
        : placeholderImageUrl

  const hasImage = !!resolvedImageUrl
  const isFallbackImage = resolvedImageUrl === fallbackImage
  const isPlaceholder = resolvedImageUrl === placeholderImageUrl && !isFallbackImage
  const bgColor = useImageEdgeColor(resolvedImageUrl ?? null, 'var(--ods-bg-secondary)')

  const renderSkeleton = () => isCompact ? (
    <div className="my-4">
      <div className="flex flex-row border border-ods-border rounded-lg overflow-hidden bg-ods-card h-[120px]">
        <div className="w-[200px] h-full flex-shrink-0 bg-ods-border animate-pulse" />
        <div className="flex-1 p-3 flex flex-col justify-center">
          <div className="bg-ods-border rounded animate-pulse h-4 w-3/4 mb-2" />
          <div className="bg-ods-border rounded animate-pulse h-3 w-full mb-1" />
          <div className="bg-ods-border rounded animate-pulse h-3 w-2/3 mb-2" />
          <div className="bg-ods-border rounded animate-pulse h-3 w-1/3" />
        </div>
      </div>
    </div>
  ) : (
    <div className="my-6">
      <div className="block border border-ods-border rounded-lg overflow-hidden bg-ods-card">
        <div className="aspect-video w-full bg-ods-border overflow-hidden relative animate-pulse" />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-ods-border rounded flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="h-[2.5rem] leading-[1.25rem] mb-2 overflow-hidden">
                <div className="bg-ods-border rounded animate-pulse" style={{ height: '1.25rem', marginBottom: '0.25rem' }} />
                <div className="bg-ods-border rounded animate-pulse w-3/4" style={{ height: '1.25rem' }} />
              </div>
              <div className="h-[2.5rem] leading-[1.25rem] mb-2 overflow-hidden">
                <div className="bg-ods-border rounded animate-pulse" style={{ height: '1.25rem', marginBottom: '0.25rem' }} />
                <div className="bg-ods-border rounded animate-pulse w-5/6" style={{ height: '1.25rem' }} />
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-ods-border rounded animate-pulse" style={{ height: '0.75rem', width: '6rem' }} />
                <div className="bg-ods-border rounded animate-pulse" style={{ height: '0.75rem', width: '5rem' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (!url || typeof url !== 'string' || !isValidUrl) return renderSkeleton()

  if (isLocalhost) {
    return (
      <div className="my-6">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-ods-accent hover:text-ods-accent-hover transition-colors">
          <span className="underline">{url}</span>
          <ExternalLinkIcon size={14} />
        </a>
      </div>
    )
  }

  if (loading) return renderSkeleton()
  if (!effectiveData) return renderSkeleton()

  const title = fallbackTitle || effectiveData.title
  // Empty string when the scrape returned nothing — descriptions render
  // conditionally below. Avoids the legacy `'No description available'` filler
  // that signaled "broken card" to users.
  const description = fallbackDescription || effectiveData.description || ''
  const ogDomain = getDomain(effectiveData.url)
  const faviconSrc = effectiveData.favicon || `https://www.google.com/s2/favicons?domain=${ogDomain}&sz=32`
  const logoSrc = publicationLogo || faviconSrc

  const handleImageError = () => {
    if (effectiveData.image && !imageError) setImageError(true)
    else if (effectiveData.originalImage && !originalImageError) setOriginalImageError(true)
    else setFallbackImageError(true)
  }

  const renderImage = () => {
    if (!resolvedImageUrl) return null
    if (isPlaceholder) {
      return (
        <img src={resolvedImageUrl} alt={title}
          className="absolute inset-0 w-full h-full object-cover rounded-md" />
      )
    }
    if (isFallbackImage) {
      return (
        <Image src={resolvedImageUrl} alt={title} fill
          className="object-contain rounded-md group-hover:scale-105 transition-transform duration-300"
          onError={handleImageError}
          unoptimized={resolvedImageUrl.includes('/render/image/')} />
      )
    }
    return (
      <img src={resolvedImageUrl} alt={title}
        className="absolute inset-0 w-full h-full object-contain rounded-md group-hover:scale-105 transition-transform duration-300"
        onError={handleImageError} />
    )
  }

  if (isCompact) {
    if (!hasImage) {
      return (
        <div className="my-4">
          <a href={effectiveData.url} target="_blank" rel="noopener noreferrer"
            className="flex flex-row items-center gap-3 border border-ods-border rounded-lg overflow-hidden bg-ods-card hover:border-ods-accent transition-all duration-200 group px-4 py-3">
            <div className="w-8 h-8 bg-ods-bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
              <Favicon src={faviconSrc} size="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-sans text-sm font-semibold text-ods-text-primary group-hover:text-ods-accent transition-colors truncate">{title}</h3>
              {description && (
                <p className="font-sans text-xs text-ods-text-secondary truncate">{description}</p>
              )}
            </div>
            <ExternalLinkIcon size={14} />
          </a>
        </div>
      )
    }
    return (
      <div className="my-4">
        <a href={effectiveData.url} target="_blank" rel="noopener noreferrer"
          className="flex flex-row border border-ods-border rounded-lg overflow-hidden bg-ods-card hover:border-ods-accent transition-colors group h-[120px]">
          <div className="w-[200px] h-full flex-shrink-0 overflow-hidden relative flex items-center justify-center rounded-lg transition-colors duration-300" style={{ backgroundColor: bgColor }}>
            {renderImage()}
          </div>
          <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
            <h3 className="font-sans text-sm font-semibold text-ods-text-primary overflow-hidden group-hover:text-ods-accent transition-colors"
              style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{title}</h3>
            {description && (
              <p className="font-sans text-xs text-ods-text-secondary overflow-hidden mt-1"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{description}</p>
            )}
            <div className="text-xs text-ods-text-secondary mt-1 truncate">{effectiveData.siteName || ogDomain}</div>
          </div>
        </a>
      </div>
    )
  }

  if (!hasImage) {
    return (
      <div className="my-6">
        <a href={effectiveData.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 border border-ods-border rounded-lg overflow-hidden bg-ods-card hover:border-ods-accent transition-all duration-200 group px-4 py-3">
          <div className="w-10 h-10 bg-ods-bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
            <Favicon src={faviconSrc} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-sans font-semibold text-ods-text-primary text-base group-hover:text-ods-accent transition-colors truncate">{title}</h3>
            {description && (
              <p className="font-sans text-sm text-ods-text-secondary truncate">{description}</p>
            )}
          </div>
          <ExternalLinkIcon />
        </a>
      </div>
    )
  }

  return (
    <div className="my-6">
      <a href={effectiveData.url} target="_blank" rel="noopener noreferrer"
        className="block border border-ods-border rounded-lg overflow-hidden bg-ods-card hover:border-ods-accent transition-colors group">
        <div className="aspect-video w-full overflow-hidden relative flex items-center justify-center rounded-lg transition-colors duration-300" style={{ backgroundColor: bgColor }}>
          {renderImage()}
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <img src={logoSrc} alt={publicationName || ''} className="w-6 h-6 rounded object-contain flex-shrink-0 mt-0.5"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div className="flex-1 min-w-0">
              <h3 className="font-sans font-semibold text-ods-text-primary text-base overflow-hidden group-hover:text-ods-accent transition-colors h-[2.5rem] leading-[1.25rem] mb-2"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title}</h3>
              {description && (
                <p className="font-sans text-sm text-ods-text-secondary overflow-hidden h-[2.5rem] leading-[1.25rem] mb-2"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-ods-text-secondary">
                <span className="font-medium">{effectiveData.siteName}</span>
                <span>•</span>
                <span className="truncate">{ogDomain}</span>
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  )
}
