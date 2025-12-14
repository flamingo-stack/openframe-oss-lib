/**
 * Shared Date Formatting Utilities
 * Single source of truth for date formatting across the application
 */

/**
 * Format release date - avoids timezone shifts
 * Used in product releases list and detail pages
 *
 * @param dateString - ISO date string (e.g., "2025-11-11T00:00:00Z")
 * @returns Formatted date (e.g., "November 11, 2025")
 */
export function formatReleaseDate(dateString: string): string {
  const [year, month, day] = dateString.split('T')[0].split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}
