import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combine class names with Tailwind's merge utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a human-readable string
 * @param date - The date to format (Date object or ISO string)
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn("Invalid date provided to formatDate:", date)
    return "Invalid Date"
  }
  
  return dateObj.toLocaleDateString("en-US", options)
}

/**
 * Format a number with thousands separators
 * @param num - The number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format a price with currency symbol
 * @param price - The price to format
 * @param currency - The currency code
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price)
}

/**
 * Format bytes to a human-readable string (KB, MB, GB, etc.)
 * @param bytes - The number of bytes
 * @param decimals - Number of decimal places
 * @returns Formatted bytes string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

/**
 * Platform URL mappings for production (with environment variable overrides)
 */
function getPlatformProductionUrl(platform: string): string {
  switch (platform) {
    case 'marketing-hub':
      return process.env.NEXT_PUBLIC_MARKETING_URL || 'https://marketing-hub.flamingo.so';
    case 'product-hub':
      return process.env.NEXT_PUBLIC_PRODUCT_URL || 'https://product-hub.flamingo.so';
    case 'revenue-hub':
      return process.env.NEXT_PUBLIC_REVENUE_URL || 'https://revenue-hub.flamingo.so';
    case 'people-hub':
      return process.env.NEXT_PUBLIC_PEOPLE_URL || 'https://people-hub.flamingo.so';
    case 'admin-hub':
      return process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin-hub.flamingo.so';
    case 'openmsp':
      return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://www.openmsp.ai';
    case 'flamingo':
      return process.env.NEXT_PUBLIC_FLAMINGO_URL || 'https://flamingo.run';
    case 'tmcg':
      return process.env.NEXT_PUBLIC_TMCG_URL || 'https://tmcg.miami';
    case 'flamingo-teaser':
      return process.env.NEXT_PUBLIC_TEASER_URL || 'https://flamingo.cx';
    case 'openframe':
      return process.env.NEXT_PUBLIC_OPENFRAME_URL || 'https://openframe.ai';
    case 'universal':
      return process.env.NEXT_PUBLIC_FLAMINGO_URL || 'https://flamingo.run';
    default:
      return process.env.NEXT_PUBLIC_FLAMINGO_URL || 'https://flamingo.run';
  }
}

/**
 * Get ALL unique base domains from getPlatformProductionUrl
 *
 * Extracts domains by calling getPlatformProductionUrl for each platform identifier.
 * Platform identifiers match the switch cases in getPlatformProductionUrl.
 *
 * Handles 3 cases:
 * 1. LOCALHOST DEBUG - No domain (hostname-specific cookies)
 * 2. VERCEL PREVIEW (*.vercel.app) - Use vercel.app domain
 * 3. PRODUCTION - Extract from ALL platform URLs via getPlatformProductionUrl
 *
 * @returns Array of all unique base domains (with and without wildcard)
 */
export function getAllPlatformBaseDomains(): string[] {
  if (typeof window === 'undefined') return []

  const hostname = window.location.hostname

  // Case 1: LOCALHOST DEBUG - no domains needed
  if (hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('127.')) {
    return []
  }

  // Case 2: VERCEL PREVIEW - use vercel.app domain
  const isVercelPreview = process.env.VERCEL_ENV === 'preview' ||
                         process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' ||
                         hostname.includes('.vercel.app')

  if (isVercelPreview) {
    return ['.vercel.app', 'vercel.app']
  }

  // Case 3: PRODUCTION - extract from ALL platforms using getPlatformProductionUrl
  // Platform identifiers match switch cases in getPlatformProductionUrl
  const platformIdentifiers = [
    'marketing-hub', 'product-hub', 'revenue-hub', 'people-hub', 'admin-hub',
    'openmsp', 'flamingo', 'tmcg', 'flamingo-teaser', 'openframe', 'universal'
  ]

  const baseDomains = new Set<string>()

  platformIdentifiers.forEach(platform => {
    try {
      const url = getPlatformProductionUrl(platform)
      const urlHostname = new URL(url).hostname
      const parts = urlHostname.split('.')

      if (parts.length >= 2) {
        const baseDomain = parts.slice(-2).join('.')
        baseDomains.add(`.${baseDomain}`) // Wildcard
        baseDomains.add(baseDomain) // Non-wildcard
      }
    } catch (error) {
      console.warn('[Platform Domains] Failed to parse URL for platform:', platform, error)
    }
  })

  return Array.from(baseDomains)
}

/**
 * Get the application base URL for the current environment
 *
 * @param platform - Optional platform name (openmsp, flamingo, tmcg, openframe, etc.)
 * @returns The base URL with protocol (https:// or http://)
 *
 * Priority order:
 * 1. Environment variable override (NEXT_PUBLIC_*_URL)
 * 2. Platform-specific URL (if platform parameter provided)
 * 3. VERCEL_PROJECT_PRODUCTION_URL (Vercel production domain)
 * 4. Production fallback (current app or openmsp)
 * 5. Development (http://localhost:3000)
 *
 * Environment Variables (optional overrides):
 * - NEXT_PUBLIC_MARKETING_URL   -> marketing-hub.flamingo.so
 * - NEXT_PUBLIC_PRODUCT_URL     -> product-hub.flamingo.so
 * - NEXT_PUBLIC_REVENUE_URL     -> revenue-hub.flamingo.so
 * - NEXT_PUBLIC_PEOPLE_URL      -> people-hub.flamingo.so
 * - NEXT_PUBLIC_ADMIN_URL       -> admin-hub.flamingo.so
 * - NEXT_PUBLIC_PLATFORM_URL    -> www.openmsp.ai
 * - NEXT_PUBLIC_FLAMINGO_URL    -> flamingo.run
 * - NEXT_PUBLIC_TMCG_URL        -> tmcg.miami
 * - NEXT_PUBLIC_TEASER_URL      -> flamingo.cx
 * - NEXT_PUBLIC_OPENFRAME_URL   -> openframe.ai
 *
 * @example
 * getBaseUrl() // Current app URL
 * getBaseUrl('flamingo') // https://flamingo.run (production) or http://localhost:3000 (dev)
 * getBaseUrl('openmsp') // https://www.openmsp.ai (or NEXT_PUBLIC_PLATFORM_URL if set)
 */
export function getBaseUrl(platform?: string): string {
  // In development, always use localhost (regardless of platform)
  if (process.env.NODE_ENV !== 'production') {
    return process.env.NEXT_PUBLIC_DEV_URL || 'http://localhost:3000'
  }

  // If platform is specified, return its production URL with env variable override support
  if (platform) {
    return getPlatformProductionUrl(platform)
  }

  // Production: Use Vercel domain if available
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Production fallback: Use canonical www domain to avoid Google "Page with redirect" issue.
  // openmsp.ai redirects to www.openmsp.ai, so we set the base URL to the
  // final destination to ensure canonical URLs do not require a redirect.
  return 'https://www.openmsp.ai'
}
