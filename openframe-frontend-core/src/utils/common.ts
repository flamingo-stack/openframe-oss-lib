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

