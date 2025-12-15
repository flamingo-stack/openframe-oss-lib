import { useEffect, useState } from 'react'

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

  useEffect(() => {
    let cleanup: (() => void) | undefined

    if (imageUrl) {
      setIsLoading(true)
      setError(null)

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

      // Add cache buster (use refreshKey if provided, otherwise timestamp)
      const cacheBuster = refreshKey ? `?v=${refreshKey}` : `?t=${Date.now()}`
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
      fetch(fullImageUrl, {
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
          setFetchedImageUrl(objectUrl)
          setIsLoading(false)

          // Setup cleanup function
          cleanup = () => {
            URL.revokeObjectURL(objectUrl)
          }
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Failed to fetch image')
          setFetchedImageUrl(undefined)
          setIsLoading(false)
        })
    } else {
      // No imageUrl provided
      setFetchedImageUrl(undefined)
      setIsLoading(false)
      setError(null)
    }

    // Cleanup blob URL on unmount or when imageUrl/refreshKey changes
    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [imageUrl, refreshKey, config])

  return { imageUrl: fetchedImageUrl, isLoading, error }
}
