/**
 * Status color-scheme resolver used by chat-adjacent badges (StatusBadge
 * components rendering job, ClickUp task, and log-level statuses).
 *
 * Lib-side subset of the hub's `lib/utils/agent-status-message.ts`. The
 * hub file also carries CSS-class resolvers + an `AgentStatusMessage`
 * builder for the SSE-status surface; those live hub-side because they
 * reference hub-only ODS class names. This function returns the abstract
 * color scheme name only — the consuming `StatusBadge` (in this lib)
 * maps it to concrete colors.
 */

export type ColorScheme = 'success' | 'error' | 'warning' | 'cyan' | 'default'

/**
 * Map a status to a color scheme name for StatusBadge components.
 * Supports job/processing statuses, ClickUp task statuses, and log levels.
 */
export function getStatusColorScheme(status: string): ColorScheme {
  const s = status?.toLowerCase() || ''

  // Exact matches first (most common)
  switch (status) {
    case 'completed':
    case 'success':
    case 'active':          // review cycles, feature flags, etc.
      return 'success'
    case 'failed':
    case 'failure':
    case 'cancelled':
    case 'error':
      return 'error'
    case 'running':
    case 'processing':
    case 'closed':          // review cycles past their active window
      return 'cyan'
    case 'pending':
    case 'warning':
      return 'warning'
    case 'draft':           // review cycles not yet opened to reviewers
    case 'info':
      return 'default'
  }

  // Partial matches for ClickUp-style statuses (Complete, Done, Working, etc.)
  if (s.includes('complete') || s.includes('done')) return 'success'
  if (s.includes('review')) return 'cyan'
  if (s.includes('working') || s.includes('progress')) return 'warning'
  if (s.includes('blocked') || s.includes('failed')) return 'error'

  return 'default'
}
