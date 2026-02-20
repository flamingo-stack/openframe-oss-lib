import { useEffect, useState, useRef } from 'react'

/**
 * Configuration for single image fetching
 * Uses same config as batch image fetching for consistency
 */
export interface AuthenticatedImageConfig {
  /** Base URL for tenant-specific API calls (e.g., 'https://tenant.openframe.dev' or '') */
  tenantHostUrl?: string
  /** Enable dev mode with Bearer token from localStorage */
  enableDevMode?: boolean
  /** localStorage key for access token (default: 'of_access_token') */
  accessTokenKey?: string
}

/**
 * Global configuration for authenticated image fetching
 * Shared with useBatchImages for consistency
 */
let globalImageConfig: AuthenticatedImageConfig = {}

/**
 * Global cache for authenticated images
 * Stores blob URLs by cache key
 */
interface ImageCacheEntry {
  blobUrl: string
  timestamp: number
  refCount: number
}

const imageCache = new Map<string, ImageCacheEntry>()
const pendingRequests = new Map<string, Promise<string | undefined>>()

/**
 * Cache cleanup interval (5 minutes)
 */
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000

/**
 * Cache entry max age (30 minutes)
 */
const CACHE_MAX_AGE = 30 * 60 * 1000

/**
 * Clean up expired cache entries
 */
function cleanupImageCache() {
  const now = Date.now()
  for (const [key, entry] of imageCache.entries()) {
    if (entry.refCount === 0 && now - entry.timestamp > CACHE_MAX_AGE) {
      URL.revokeObjectURL(entry.blobUrl)
      imageCache.delete(key)
    }
  }
}

/**
 * Periodic cache cleanup
 */
if (typeof window !== 'undefined') {
  setInterval(cleanupImageCache, CACHE_CLEANUP_INTERVAL)
}

/**
 * Configure global settings for authenticated image fetching
 * Call this once in your app initialization (e.g., _app.tsx or layout.tsx)
 *
 * Note: This uses the same configuration as useBatchImages. If you've already
 * called configureBatchImageFetch(), you don't need to call this separately.
 *
 * @example
 * ```typescript
 * // In app initialization
 * configureAuthenticatedImage({
 *   tenantHostUrl: process.env.NEXT_PUBLIC_TENANT_HOST_URL || '',
 *   enableDevMode: process.env.NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER === 'true'
 * })
 * ```
 */
export function configureAuthenticatedImage(config: AuthenticatedImageConfig): void {
  globalImageConfig = { ...globalImageConfig, ...config }
}

/**
 * Get current authenticated image configuration
 */
function getImageConfig(): Required<AuthenticatedImageConfig> {
  return {
    tenantHostUrl: globalImageConfig.tenantHostUrl || '',
    enableDevMode: globalImageConfig.enableDevMode ?? false,
    accessTokenKey: globalImageConfig.accessTokenKey || 'of_access_token'
  }
}

/**
 * React hook to fetch a single image with authentication
 *
 * Features:
 * - Fetches image with cookie authentication
 * - Optional Bearer token in dev mode
 * - Converts to blob URL for img src
 * - Automatic cleanup of blob URLs
 * - Cache-busting with refreshKey
 * - Loading and error states
 * - **Global caching** - Prevents duplicate requests for identical URLs
 * - **Automatic deduplication** - Multiple components using same URL share cached result
 * - **Reference counting** - Cached blobs cleaned up when no longer used
 *
 * @param imageUrl - The image URL to fetch (null/undefined = no fetch)
 * @param refreshKey - Optional key to force re-fetch (e.g., version number, timestamp)
 * @param config - Optional configuration override
 * @returns Object with imageUrl (blob), isLoading, and error
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { imageUrl, isLoading, error } = useAuthenticatedImage(
 *   organization?.imageUrl
 * )
 *
 * // With refresh key (e.g., after upload)
 * const { imageUrl } = useAuthenticatedImage(
 *   organization?.imageUrl,
 *   organization?.imageVersion // Timestamp or version number
 * )
 *
 * // In render
 * {imageUrl && <img src={imageUrl} alt="Organization" />}
 * ```
 */
export function useAuthenticatedImage(
  imageUrl?: string | null,
  refreshKey?: string | number,
  config?: AuthenticatedImageConfig
): {
  imageUrl: string | undefined
  isLoading: boolean
  error: string | null
} {
  const [fetchedImageUrl, setFetchedImageUrl] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentCacheKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!imageUrl) {
      setFetchedImageUrl(undefined)
      setIsLoading(false)
      setError(null)
      
      if (currentCacheKeyRef.current) {
        const entry = imageCache.get(currentCacheKeyRef.current)
        if (entry) {
          entry.refCount--
        }
        currentCacheKeyRef.current = null
      }
      return
    }

    const { tenantHostUrl, enableDevMode, accessTokenKey } = {
      ...getImageConfig(),
      ...config
    }

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

    // Create cache key (use refreshKey if provided, otherwise no cache buster for caching)
    const cacheKey = refreshKey ? `${fullImageUrl}?v=${refreshKey}` : fullImageUrl
    
    if (currentCacheKeyRef.current && currentCacheKeyRef.current !== cacheKey) {
      const prevEntry = imageCache.get(currentCacheKeyRef.current)
      if (prevEntry) {
        prevEntry.refCount--
      }
    }
    
    currentCacheKeyRef.current = cacheKey

    const cachedEntry = imageCache.get(cacheKey)
    if (cachedEntry) {
      cachedEntry.refCount++
      cachedEntry.timestamp = Date.now()
      
      setFetchedImageUrl(cachedEntry.blobUrl)
      setIsLoading(false)
      setError(null)
      return
    }

    const pendingRequest = pendingRequests.get(cacheKey)
    if (pendingRequest) {
      setIsLoading(true)
      setError(null)
      
      pendingRequest
        .then(blobUrl => {
          if (blobUrl) {
            const entry = imageCache.get(cacheKey)
            if (entry) {
              entry.refCount++
              setFetchedImageUrl(blobUrl)
            }
          }
          setIsLoading(false)
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Failed to fetch image')
          setIsLoading(false)
        })
      return
    }

    setIsLoading(true)
    setError(null)

    const requestUrl = refreshKey ? cacheKey : `${fullImageUrl}?t=${Date.now()}`

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

    const fetchPromise = fetch(requestUrl, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`)
        }
        return response.blob()
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob)
        
        imageCache.set(cacheKey, {
          blobUrl: objectUrl,
          timestamp: Date.now(),
          refCount: 1
        })
        
        setFetchedImageUrl(objectUrl)
        setIsLoading(false)
        return objectUrl
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to fetch image')
        setFetchedImageUrl(undefined)
        setIsLoading(false)
        throw err
      })
      .finally(() => {
        pendingRequests.delete(cacheKey)
      })

    pendingRequests.set(cacheKey, fetchPromise)

  }, [imageUrl, refreshKey, config])

  useEffect(() => {
    return () => {
      if (currentCacheKeyRef.current) {
        const entry = imageCache.get(currentCacheKeyRef.current)
        if (entry) {
          entry.refCount--
        }
      }
    }
  }, [])

  return { imageUrl: fetchedImageUrl, isLoading, error }
}
