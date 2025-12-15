/**
 * Utility functions for formatting data
 */

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
 * Format large numbers to abbreviated form (K, M, B) with no decimal points
 * @param num - The number to format
 * @returns Formatted number string (e.g., "1K", "2M", "3B")
 */
export function formatLargeNumber(num: number): string {
  if (num === 0) return "0"
  
  // Handle negative numbers
  const isNegative = num < 0
  const absNum = Math.abs(num)
  
  let result: string
  
  if (absNum >= 1_000_000_000) {
    // Billions
    result = `${Math.floor(absNum / 1_000_000_000)}B`
  } else if (absNum >= 1_000_000) {
    // Millions
    result = `${Math.floor(absNum / 1_000_000)}M`
  } else if (absNum >= 1_000) {
    // Thousands
    result = `${Math.floor(absNum / 1_000)}K`
  } else {
    // Less than 1000, show as-is
    result = Math.floor(absNum).toString()
  }
  
  return isNegative ? `-${result}` : result
}

/**
 * Abbreviate large numbers for compact display.
 * 1 200 → 1.2K , 15 000 → 15K , 2 000 000 → 2M
 * Mirrors helper previously embedded in profile components.
 * @param n Number to format
 */
export function formatAbbreviatedNumber(n: number): string {
  if (n >= 1_000_000_000) {
    const value = n / 1_000_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const value = n / 1_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const value = n / 1_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}K`;
  }
  return n.toLocaleString();
}
