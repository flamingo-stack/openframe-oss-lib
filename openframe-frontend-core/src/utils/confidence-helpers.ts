/**
 * Confidence helpers for AI enrichment
 * Shared utilities for displaying confidence levels from AI operations
 */

/**
 * Get Tailwind CSS classes for confidence badge display (border and text color)
 * @param confidence - Confidence score (0-100)
 * @returns CSS classes for border and text color
 */
export function getConfidenceColorClass(confidence?: number): string {
  if (!confidence && confidence !== 0) return '';
  if (confidence >= 80) return 'border-green-500 text-green-500';
  if (confidence >= 50) return 'border-yellow-500 text-yellow-500';
  return 'border-red-500 text-red-500';
}

/**
 * Get confidence level category
 * @param confidence - Confidence score (0-100)
 * @returns Confidence level category
 */
export function getConfidenceLevel(confidence?: number): 'high' | 'medium' | 'low' | 'none' {
  if (!confidence && confidence !== 0) return 'none';
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

/**
 * Get Tailwind CSS class for border color only
 * @param confidence - Confidence score (0-100)
 * @returns CSS class for border color
 */
export function getConfidenceBorderClass(confidence?: number): string {
  if (!confidence && confidence !== 0) return '';
  if (confidence >= 80) return 'border-green-500';
  if (confidence >= 50) return 'border-yellow-500';
  return 'border-red-500';
}

/**
 * Get Tailwind CSS class for text color only
 * @param confidence - Confidence score (0-100)
 * @returns CSS class for text color
 */
export function getConfidenceTextClass(confidence?: number): string {
  if (!confidence && confidence !== 0) return '';
  if (confidence >= 80) return 'text-green-500';
  if (confidence >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

/**
 * Get Tailwind CSS class for background color (subtle)
 * @param confidence - Confidence score (0-100)
 * @returns CSS class for subtle background color
 */
export function getConfidenceBgClass(confidence?: number): string {
  if (!confidence && confidence !== 0) return '';
  if (confidence >= 80) return 'bg-green-500/10';
  if (confidence >= 50) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
}

/**
 * Get descriptive label for confidence level
 * @param confidence - Confidence score (0-100)
 * @returns Human-readable confidence label
 */
export function getConfidenceLabel(confidence?: number): string {
  if (!confidence && confidence !== 0) return 'Unknown';
  if (confidence >= 80) return 'High';
  if (confidence >= 50) return 'Medium';
  return 'Low';
}
