/**
 * Unified Date Utilities for OpenMSP Platform
 * Provides consistent date formatting across all components
 */

/**
 * Relative display label for a ticket timestamp (ISO string).
 * < 1 min → "Just now" | 1-59 min → "X min ago" | 1-23 h → "X hour(s) ago" | 24+ h → "MM/DD/YYYY"
 */
export function formatTicketRelativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  // UTC getters so the MM/DD/YYYY tail is identical on server (UTC) and client
  // (local) — otherwise React #418 hydration mismatch.
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${mm}/${dd}/${yyyy}`
}

/**
 * Full tooltip timestamp in "MM/DD/YYYY, H:MM AM/PM" format.
 */
export function formatTicketFullTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  // UTC getters so the tooltip timestamp is identical on server (UTC) and
  // client (local) — otherwise React #418 hydration mismatch.
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  let hours = date.getUTCHours()
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${mm}/${dd}/${yyyy}, ${hours}:${minutes} ${ampm}`
}

/**
 * Format relative time from ISO timestamp
 * This is the single source of truth for all relative time formatting
 * 
 * @param timestamp - ISO timestamp string or Date object
 * @returns Formatted relative time string
 * 
 * @example
 * formatRelativeTime('2024-01-01T12:00:00Z') // '2 hours ago'
 * formatRelativeTime(new Date()) // 'Just now'
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  const targetTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  // Validate the date
  if (isNaN(targetTime.getTime())) {
    console.warn('⚠️ Invalid timestamp in formatRelativeTime:', timestamp);
    return 'Unknown time';
  }
  
  const diffInMs = now.getTime() - targetTime.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  
  // Handle future dates (should not happen but graceful fallback)
  if (diffInMinutes < 0) {
    return 'Just now';
  }
  
  // Less than 1 minute
  if (diffInMinutes < 1) return 'Just now';
  
  // 1-59 minutes
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  // 1-23 hours  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  // 1-6 days
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  // 1-4 weeks
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks}w ago`;
  }
  
  // Older than 30 days - show formatted date, pinned to UTC so SSR (UTC) and
  // the client agree (React #418). Year comparison also uses UTC for the same
  // reason (avoids a server/client split right at a year boundary).
  return targetTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: targetTime.getUTCFullYear() !== now.getUTCFullYear() ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

/**
 * Format absolute date for display
 * 
 * @param timestamp - ISO timestamp string or Date object
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string
 */
export function formatAbsoluteDate(
  timestamp: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const targetTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(targetTime.getTime())) {
    console.warn('⚠️ Invalid timestamp in formatAbsoluteDate:', timestamp);
    return 'Invalid date';
  }
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    // Pin to UTC so SSR (Vercel = UTC) and the client agree (React #418).
    // Caller can override via `options`.
    timeZone: 'UTC',
    ...options
  };

  return targetTime.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format timestamp with time included
 * 
 * @param timestamp - ISO timestamp string or Date object
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted datetime string
 */
export function formatDateTime(
  timestamp: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const targetTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(targetTime.getTime())) {
    console.warn('⚠️ Invalid timestamp in formatDateTime:', timestamp);
    return 'Invalid date';
  }
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    // Pin to UTC so SSR (Vercel = UTC) and the client agree (React #418).
    // Caller can override via `options`.
    timeZone: 'UTC',
    ...options
  };

  return targetTime.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Get time difference in human readable format (detailed)
 * 
 * @param timestamp - ISO timestamp string or Date object
 * @returns Detailed time difference string
 */
export function getDetailedTimeDifference(timestamp: string | Date): string {
  const now = new Date();
  const targetTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(targetTime.getTime())) {
    return 'Invalid date';
  }
  
  const diffInMs = now.getTime() - targetTime.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays < 30) return `${diffInDays} days ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} months ago`;
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} years ago`;
}

/**
 * Check if a timestamp is today
 */
export function isToday(timestamp: string | Date): boolean {
  const today = new Date();
  const targetTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  return today.toDateString() === targetTime.toDateString();
}

/**
 * Check if a timestamp is within the last N minutes
 */
export function isWithinMinutes(timestamp: string | Date, minutes: number): boolean {
  const now = new Date();
  const targetTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const diffInMs = now.getTime() - targetTime.getTime();
  const diffInMinutes = diffInMs / (1000 * 60);
  
  return diffInMinutes <= minutes && diffInMinutes >= 0;
}

/**
 * Create a UTC timestamp string for database insertion
 */
export function createUTCTimestamp(): string {
  return new Date().toISOString();
} 