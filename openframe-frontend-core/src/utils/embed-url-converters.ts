/**
 * Shared utilities for converting external service URLs to embeddable formats.
 * Used by lib's embed components and the hub's admin document editor.
 */

export function toGoogleSheetsEmbedUrl(url: string): string {
  if (url.includes('/htmlembed')) return url

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return url

  const gidMatch = url.match(/[#?&]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'

  return `https://docs.google.com/spreadsheets/d/${match[1]}/htmlembed?widget=true&chrome=false&headers=false&gid=${gid}`
}

export function toGoogleSheetsOriginalUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return url

  const gidMatch = url.match(/[#?&]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'

  return `https://docs.google.com/spreadsheets/d/${match[1]}/edit#gid=${gid}`
}

/**
 * Convert a Figma URL to an embeddable URL.
 * Slides/deck URLs map to `deck` (present) by default; `slidesView: 'browse'` switches to `slides` (browse).
 */
export function toFigmaEmbedUrl(
  url: string,
  opts?: { slidesView?: 'present' | 'browse' }
): string {
  if (url.includes('embed.figma.com')) return url
  if (url.includes('figma.com/embed')) return url

  const match = url.match(
    /figma\.com\/(design|file|proto|board|slides|deck)\/([a-zA-Z0-9]+)(?:\/([^?]*))?(\?.*)?$/
  )

  if (match) {
    const [, urlType, fileKey, titleSlug, queryString] = match
    const isSlides = urlType === 'slides' || urlType === 'deck'
    const embedType =
      urlType === 'proto' ? 'proto'
      : isSlides ? (opts?.slidesView === 'browse' ? 'slides' : 'deck')
      : 'design'
    const pathSuffix = titleSlug ? `/${titleSlug}` : ''

    const params = new URLSearchParams(queryString?.replace(/^\?/, '') || '')
    if (!params.has('embed-host')) {
      params.set('embed-host', 'flamingo')
    }
    const clientId = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID
    if (clientId && !params.has('client-id')) {
      params.set('client-id', clientId)
    }

    return `https://embed.figma.com/${embedType}/${fileKey}${pathSuffix}?${params.toString()}`
  }

  return `https://www.figma.com/embed?embed-host=flamingo&url=${encodeURIComponent(url)}`
}

export function isFigmaSlidesUrl(url: string): boolean {
  if (!url) return false
  return /(?:www\.|embed\.)?figma\.com\/(?:slides|deck)\/[a-zA-Z0-9]+/.test(url)
}

export function toFigmaOriginalUrl(url: string): string {
  if (url.includes('embed.figma.com')) {
    return url.replace('embed.figma.com', 'www.figma.com').replace(/\?.*$/, '')
  }
  return url.replace(/\?.*$/, '')
}
