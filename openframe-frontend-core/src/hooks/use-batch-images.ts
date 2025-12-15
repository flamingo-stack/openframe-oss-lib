import { useEffect, useMemo, useState, useRef } from 'react'

/**
 * Configuration for batch image fetching
 */
export interface BatchImageFetchConfig {
  /** Base URL for tenant-specific API calls (e.g., 'https://tenant.openframe.dev' or '') */
  tenantHostUrl?: string
  /** Enable dev mode with Bearer token from localStorage */
  enableDevMode?: boolean
  /** localStorage key for access token (default: 'of_access_token') */
  accessTokenKey?: string
}

/**
 * Global configuration for batch image fetching
 * Can be set once at app initialization
 */
let globalBatchImageConfig: BatchImageFetchConfig = {}

/**
 * Configure global settings for batch image fetching
 * Call this once in your app initialization (e.g., _app.tsx or layout.tsx)
 *
 * @example
 * ```typescript
 * // In app initialization
 * configureBatchImageFetch({
 *   tenantHostUrl: process.env.NEXT_PUBLIC_TENANT_HOST_URL || '',
 *   enableDevMode: process.env.NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER === 'true'
 * })
 * ```
 */
export function configureBatchImageFetch(config: BatchImageFetchConfig): void {
  globalBatchImageConfig = { ...globalBatchImageConfig, ...config }
}

/**
 * Get current batch image fetch configuration
 */
function getBatchImageConfig(): Required<BatchImageFetchConfig> {
  return {
    tenantHostUrl: globalBatchImageConfig.tenantHostUrl || '',
    enableDevMode: globalBatchImageConfig.enableDevMode ?? false,
    accessTokenKey: globalBatchImageConfig.accessTokenKey || 'of_access_token'
  }
}

/**
 * Fetch multiple images with authentication in batch
 * Returns a map of original imageUrl to fetched blob URL
 *
 * @param imageUrls - Array of image URLs to fetch
 * @param config - Optional configuration override for this batch
 * @returns Promise resolving to map of original URL → blob URL
 *
 * @example
 * ```typescript
 * const images = await batchFetchAuthenticatedImages([
 *   '/api/organizations/123/image',
 *   '/api/organizations/456/image'
 * ])
 * // { '/api/organizations/123/image': 'blob:...', '/api/organizations/456/image': 'blob:...' }
 * ```
 */
export async function batchFetchAuthenticatedImages(
  imageUrls: string[],
  config?: BatchImageFetchConfig
): Promise<Record<string, string | undefined>> {
  const results: Record<string, string | undefined> = {}

  if (imageUrls.length === 0) {
    return results
  }

  const { tenantHostUrl, enableDevMode, accessTokenKey } = {
    ...getBatchImageConfig(),
    ...config
  }

  const fetchPromises = imageUrls.map(async (imageUrl) => {
    try {
      // Construct full image URL
      let fullImageUrl: string
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        fullImageUrl = imageUrl
      } else if (imageUrl.startsWith('/api/')) {
        fullImageUrl = `${tenantHostUrl}${imageUrl}`
      } else if (imageUrl.startsWith('/')) {
        fullImageUrl = `${tenantHostUrl}/api${imageUrl}`
      } else {
        fullImageUrl = `${tenantHostUrl}/api/${imageUrl}`
      }

      // Add cache buster
      const cacheBuster = `?t=${Date.now()}`
      fullImageUrl = fullImageUrl + cacheBuster

      // Prepare headers
      const headers: Record<string, string> = {
        'Accept': 'image/*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }

      // Add Bearer token in dev mode
      if (enableDevMode) {
        try {
          const accessToken = localStorage.getItem(accessTokenKey)
          if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`
          }
        } catch (error) {
          // Silently continue without token
        }
      }

      // Fetch image
      const response = await fetch(fullImageUrl, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }

      // Convert to blob URL
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      return { imageUrl, fetchedUrl: objectUrl }
    } catch (error) {
      console.warn(`Failed to fetch image ${imageUrl}:`, error)
      return { imageUrl, fetchedUrl: undefined }
    }
  })

  const fetchResults = await Promise.all(fetchPromises)

  fetchResults.forEach(({ imageUrl, fetchedUrl }) => {
    results[imageUrl] = fetchedUrl
  })

  return results
}

/**
 * React hook to batch fetch images with authentication
 *
 * Features:
 * - Automatically deduplicates URLs
 * - Caches fetched results
 * - Only fetches new/unfetched URLs
 * - Cleans up blob URLs on unmount
 *
 * @param imageUrls - Array of image URLs (can include null/undefined)
 * @param config - Optional configuration override
 * @returns Map of original URL → fetched blob URL
 *
 * @example
 * ```typescript
 * // In a component
 * const imageUrls = useMemo(() =>
 *   organizations.map(org => org.imageUrl).filter(Boolean),
 *   [organizations]
 * )
 * const fetchedImages = useBatchImages(imageUrls)
 *
 * // Use in render
 * <img src={fetchedImages[org.imageUrl]} alt={org.name} />
 * ```
 */
export function useBatchImages(
  imageUrls: (string | null | undefined)[],
  config?: BatchImageFetchConfig
): Record<string, string | undefined> {
  const [fetchedImages, setFetchedImages] = useState<Record<string, string | undefined>>({})
  const [loading, setLoading] = useState(false)

  // Deduplicate and filter out null/undefined
  const uniqueUrls = useMemo(() =>
    Array.from(new Set(imageUrls.filter((url): url is string => Boolean(url)))),
    [imageUrls]
  )

  // Track URLs we've already requested to avoid duplicate fetches
  const requestedUrls = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (uniqueUrls.length === 0) {
      setFetchedImages({})
      return
    }

    // Find URLs we haven't fetched yet
    const urlsToFetch = uniqueUrls.filter(url => !requestedUrls.current.has(url))

    if (urlsToFetch.length === 0) {
      return // All URLs already requested
    }

    // Mark these URLs as requested
    urlsToFetch.forEach(url => requestedUrls.current.add(url))

    setLoading(true)

    batchFetchAuthenticatedImages(urlsToFetch, config)
      .then(newResults => {
        setFetchedImages(prev => ({ ...prev, ...newResults }))
      })
      .catch(error => {
        console.error('Failed to batch fetch images:', error)
      })
      .finally(() => {
        setLoading(false)
      })

    // Cleanup blob URLs on unmount
    return () => {
      Object.values(fetchedImages).forEach(blobUrl => {
        if (blobUrl && blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(blobUrl)
        }
      })
    }
  }, [uniqueUrls, config])

  return fetchedImages
}
