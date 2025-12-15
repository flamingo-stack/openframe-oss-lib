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
 * Get the application base URL for the current environment
 * Priority order:
 * 1. VERCEL_PROJECT_PRODUCTION_URL (Vercel production domain)
 * 2. Production fallback (https://openmsp.ai)
 * 3. Development (http://localhost:3000)
 * @returns The base URL with protocol (https:// or http://)
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  
  if (process.env.NODE_ENV === 'production') {
    // Use canonical www domain to avoid Google "Page with redirect" issue.
    // openmsp.ai redirects to www.openmsp.ai, so we set the base URL to the
    // final destination to ensure canonical URLs do not require a redirect.
    return 'https://www.openmsp.ai'
  }
  
  return 'http://localhost:3000'
}
