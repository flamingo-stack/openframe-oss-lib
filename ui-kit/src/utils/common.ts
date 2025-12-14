import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility functions for common operations
 */

/**
 * Merge class names with Tailwind CSS
 * @param inputs - Class names to merge
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Delay execution for a specified time
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate a random string of specified length
 * @param length - Length of the string
 * @returns Random string
 */
export function generateRandomString(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Truncate a string to a specified length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add to truncated string
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - suffix.length) + suffix
}

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Get the Slack community join URL from environment variables
 * @returns Slack community join URL or fallback URL
 */
export function getSlackCommunityJoinUrl(): string {
  const url = process.env.NEXT_PUBLIC_SLACK_COMMUNITY_JOIN_URL
  if (!url) {
    console.warn('NEXT_PUBLIC_SLACK_COMMUNITY_JOIN_URL is not defined in environment variables')
    return 'https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA'
  }
  return url
}

/**
 * Get the application base URL for the current environment
 * Priority order:
 * 1. Development - return empty string for relative paths
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel production domain)
 * 3. Platform-specific production URLs
 * @param appType - Optional app type to get URL for
 * @param forceAbsolute - Force absolute URL even in development
 * @returns The base URL with protocol (https:// or http://) or empty string for dev
 */
export function getBaseUrl(appType?: string, forceAbsolute?: boolean): string {
  // Development environment - return localhost for absolute URLs (like fetch), empty for relative paths
  if (!appType && process.env.NODE_ENV === 'development') {
    return forceAbsolute ? `http://localhost:${process.env.PORT || '3000'}` : ''
  }

  // Skip VERCEL_PROJECT_PRODUCTION_URL when appType is specified - use platform-specific URLs
  // Only use Vercel production URL as fallback when no specific platform is requested
  if (!appType && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Get app type from parameter or environment
  const currentAppType = appType || process.env.NEXT_PUBLIC_APP_TYPE

  // Platform-specific production URLs
  switch (currentAppType) {
    case 'admin-hub':
      return process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin-hub.flamingo.so'
    case 'openmsp':
      return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://www.openmsp.ai'
    case 'flamingo':
      return process.env.NEXT_PUBLIC_FLAMINGO_URL || 'https://www.flamingo.run'
    case 'flamingo-teaser':
      return process.env.NEXT_PUBLIC_FLAMINGO_TEASER_URL || 'https://preview.flamingo.so'
    case 'tmcg':
      return process.env.NEXT_PUBLIC_TMCG_URL || 'https://tmcg.miami'
    default:
      return process.env.NEXT_PUBLIC_APP_URL || 'https://www.openmsp.ai'
  }
}
