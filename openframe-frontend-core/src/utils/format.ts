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
 * Compact bytes formatter using the single-letter unit `'B'` (not
 * `'Bytes'`). Used by upload-progress UIs where horizontal space is
 * tight and the longer "Bytes" string wraps. Tops out at `TB`.
 * @example formatBytesShort(0) → "0 B"; formatBytesShort(1536) → "1.5 KB"
 */
export function formatBytesShort(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * File-size formatter (1 decimal place, `'B'` unit, caps at `GB`).
 * Hub historical semantics — distinct from `formatBytesShort` (2dp) and
 * `formatBytes` (2dp / `'Bytes'`). Lifted from the hub during the doc-viewer
 * unification so all upload UIs, publication cards, and data-room file-size
 * displays render the same way.
 * @example formatFileSize(0) → "0 B"; formatFileSize(1500) → "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
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

/**
 * Two-letter uppercase initials from the FIRST + LAST word of a name.
 * Used by avatar-style fallbacks (SquareAvatar, EntityImage) where
 * "John Michael Doe" → "JD" reads better than "JM".
 *
 * Returns `''` for empty / whitespace-only input. Single-word names
 * return a single uppercase letter. Pure — same input always produces
 * the same output, no locale or timezone surface.
 */
export function getFirstLastInitials(name?: string | null): string {
  if (!name) return ''
  const words = name.trim().split(/\s+/)
  if (words.length === 0 || !words[0]) return ''
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

/**
 * Two-letter uppercase initials from the FIRST + SECOND word of a name.
 * Used as SquareAvatar / EntityImage / EntityAuthorCard fallback across
 * admin and public pages in both the lib and the hub. Handles empty
 * strings, all-whitespace input, and single-word names cleanly — always
 * returns at least one character so the fallback slot is never empty.
 *
 * Single source of truth: every "first-letter of each word, uppercase,
 * max 2 chars" computation across hub + lib MUST come through here.
 */
export function nameInitials(
  name: string | null | undefined,
  fallback: string = 'E',
): string {
  const source = typeof name === 'string' ? name.trim() : ''
  const words = source.length > 0 ? source.split(/\s+/) : []
  const letters = words
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
  return (letters || fallback).toUpperCase()
}

/**
 * Format seconds to MM:SS or HH:MM:SS format
 * Used for media durations (podcasts, videos)
 * Returns: "MM:SS" or "HH:MM:SS" if hours > 0
 */
export function formatDurationMMSS(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to compact human-readable duration
 * Used for displaying duration in cards and headers
 * Returns: "Xh Xm" or "X min"
 */
export function formatDurationCompact(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Format time with optional timezone
 * Used for webinar and event times
 * Returns: "10:30 AM EST" or "10:30 AM"
 */
export function formatTimeWithTimezone(
  date: Date | string | null | undefined,
  timezone?: string | null
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return timezone ? `${timeStr} ${timezone}` : timeStr;
}

/**
 * Calculate and format duration between two timestamps
 * Used for webinar durations
 * Returns: "1h 30m" or "45m"
 */
export function formatDurationFromRange(
  startAt: string | Date | null | undefined,
  endAt: string | Date | null | undefined
): string {
  if (!startAt || !endAt) return '';

  const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const end = typeof endAt === 'string' ? new Date(endAt) : endAt;
  const durationMs = end.getTime() - start.getTime();
  const minutes = Math.round(durationMs / 60000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * UTC-anchored date formatter — distinct from the local-rendering
 * `formatDate` above. RAG mappers + audit-style consumers want UTC anchor
 * so date-only strings (`'2024-08-15'`) don't drift across timezones, AND
 * a `'N/A'` (or caller-supplied) fallback for missing values so the LLM
 * never sees a blank.
 *
 * Accepts:
 *   - ISO date or timestamp string (`'2024-08-15'` or `'2024-08-15T10:30:00Z'`)
 *   - Numeric epoch milliseconds
 *   - Numeric string (treated as epoch ms — Slack and GitHub timestamps
 *     sometimes arrive that way)
 *   - `null` / `undefined` / empty / unparseable → returns `options.fallback`
 *
 * Date-only strings (no `'T'`) get `T00:00:00Z` appended so they anchor to
 * UTC midnight rather than midnight in the runtime's local timezone.
 */
export interface FormatDateUTCOptions {
  /** Returned for null/undefined/empty/unparseable input. Defaults to 'N/A'. */
  fallback?: string
  /** 'UTC' (default) or 'local' — switch off the UTC anchor when audit
   *  stability matters less than local relevance (chat-card timestamps). */
  timezone?: 'UTC' | 'local'
}

export function formatDateUTC(
  value: string | number | null | undefined,
  options: FormatDateUTCOptions = {},
): string {
  const { fallback = 'N/A', timezone = 'UTC' } = options

  if (value === null || value === undefined || value === '') return fallback

  let ms: number
  if (typeof value === 'number') {
    ms = value
  } else {
    // String input — first try to interpret as a numeric epoch (Slack/GitHub
    // sometimes arrive that way). Number('') is 0, but we already ruled out
    // empty strings above.
    const n = Number(value)
    if (Number.isFinite(n) && n > 0 && /^-?\d+(\.\d+)?$/.test(value.trim())) {
      ms = n
    } else {
      // ISO string — for date-only forms, anchor to UTC midnight to avoid
      // timezone-offset drift (preserves the original RAG-mapper contract).
      ms = Date.parse(value.includes('T') ? value : value + 'T00:00:00Z')
    }
  }

  if (!Number.isFinite(ms)) return fallback

  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timezone === 'local' ? undefined : 'UTC',
  })
}

/**
 * Format a reporting-month value (`entry_month`) as "Mon YYYY" / "Month YYYY",
 * always anchored to UTC. THE single home for the "What I Shipped" month label —
 * both the lib card (`'short'`) and the hub detail page (`'long'`) call this, so
 * the React #418 UTC-pin convention lives in exactly one place. Returns `null`
 * for empty input (callers omit the label entirely).
 */
export function formatEntryMonthUTC(
  entryMonth: string | null | undefined,
  style: 'short' | 'long' = 'short',
): string | null {
  if (!entryMonth) return null
  return new Date(entryMonth).toLocaleDateString('en-US', { month: style, year: 'numeric', timeZone: 'UTC' })
}

/**
 * Format a date string as `MM/DD/YYYY` for legal-document display
 * (privacy policy, terms of service). Locale-stable: always en-US.
 */
export function formatLegalDate(dateInput: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateInput))
}

/**
 * Format a currency value as `$1,234`. Returns `'N/A'` for null/undefined.
 * USD-rounded (no cents). Used on KPI cards + investor pages.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format a percent value as `12.50%`. Returns `'N/A'` for null/undefined.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return `${value.toFixed(2)}%`
}

/**
 * Whole-dollar price (no cents) — `$1,234`. Configurable currency code.
 */
export function formatWholeDollars(price: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price)
}

// =============================================================================
// Metric Formatting (for KPI cards / investor updates)
// =============================================================================

export type MetricFormat = 'number' | 'currency' | 'percentage' | 'months'

/**
 * Polarity determines whether an increase is good or bad.
 * - 'positive': higher is better (revenue, users, MRR) → up = green, down = red
 * - 'negative': higher is worse (burn rate, churn, CAC) → up = red, down = green
 * - 'neutral':  no judgment (headcount, runway) → always gray
 */
export type TrendPolarity = 'positive' | 'negative' | 'neutral'

/**
 * Format a metric value with compact notation ($1.2M, 150K, 12 months).
 */
export function formatCompactMetric(
  value: number,
  format: MetricFormat = 'number',
  options?: { prefix?: string; suffix?: string },
): string {
  if (value === 0 || value === null || value === undefined) {
    if (format === 'currency') return `${options?.prefix || '$'}0`
    if (format === 'percentage') return '0%'
    if (format === 'months') return `0 ${options?.suffix || 'months'}`
    return '0'
  }

  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (format === 'currency') {
    const prefix = options?.prefix || '$'
    const compact = (val: number, divisor: number, suffix: string) => {
      const divided = val / divisor
      const formatted = divided % 1 === 0 ? divided.toFixed(0) : divided.toFixed(1)
      return `${sign}${prefix}${formatted}${suffix}`
    }
    if (absValue >= 1_000_000_000) return compact(absValue, 1_000_000_000, 'B')
    if (absValue >= 1_000_000) return compact(absValue, 1_000_000, 'M')
    if (absValue >= 1_000) return `${sign}${prefix}${(absValue / 1_000).toFixed(0)}K`
    return `${sign}${prefix}${absValue.toLocaleString()}`
  }

  if (format === 'percentage') {
    return `${sign}${absValue}%`
  }

  if (format === 'months') {
    const rounded = Math.round(value * 10) / 10
    return `${rounded} ${options?.suffix || 'months'}`
  }

  if (absValue >= 1_000_000) return `${sign}${(absValue / 1_000_000).toFixed(1)}M`
  if (absValue >= 1_000) return `${sign}${(absValue / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

/**
 * Get ODS trend colors based on direction AND polarity. Single source
 * of truth for trend coloring across hub + lib.
 */
export function getTrendColors(
  direction: 'up' | 'down' | 'neutral',
  polarity: TrendPolarity = 'positive',
): { textClass: string; badgeClass: string } {
  if (direction === 'neutral' || polarity === 'neutral') {
    return {
      textClass: 'text-ods-text-secondary',
      badgeClass: 'bg-ods-border text-ods-text-secondary',
    }
  }

  const isPositiveOutcome =
    (direction === 'up' && polarity === 'positive') ||
    (direction === 'down' && polarity === 'negative')

  if (isPositiveOutcome) {
    return {
      textClass: 'text-ods-success',
      badgeClass: 'bg-ods-success-secondary text-ods-success',
    }
  }

  return {
    textClass: 'text-ods-error',
    badgeClass: 'bg-ods-error-secondary text-ods-error',
  }
}

/**
 * Format a date range as `Apr 20, 2026 — Jul 20, 2026`. Used on review
 * cycle list/detail rows and summary headers.
 *
 * Accepts either full ISO timestamps or bare `YYYY-MM-DD` dates. Bare
 * dates are interpreted in the viewer's LOCAL timezone — otherwise
 * `"2026-04-20"` renders as `"Apr 19"` west of UTC. DB values for cycle
 * period are stored as plain dates, so local-tz parsing is correct.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return ''
  const fmt = (s: string): string => {
    const bareMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    const d = bareMatch
      ? new Date(Number(bareMatch[1]), Number(bareMatch[2]) - 1, Number(bareMatch[3]))
      : new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return `${fmt(start)} — ${fmt(end)}`
}

/**
 * Format an ISO date string as `"Jan 5, 2025 at 10:30 AM"`. Used by
 * admin podcast/webinar cards where the display needs both the short
 * date AND wall-clock time in a single readable phrase.
 *
 * Uses `new Date(...).toLocale*` (NOT the TZ-safe split) because the
 * source columns store full timestamps + the wall-clock half MUST
 * render in the viewer's local timezone (a podcast scheduled "10:30 AM
 * EST" should display "10:30 AM" for the Eastern admin, "7:30 AM" for
 * the Pacific admin — viewer-local is the right semantics here, unlike
 * date-only fields).
 */
export function formatDateTimeAt(dateString: string): string {
  const date = new Date(dateString)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${dateStr} at ${timeStr}`
}

/**
 * Format a duration measured in MILLISECONDS as a compact human-readable
 * string. Returns `"0ms"` for null/NaN/negative, then `Xms` → `X.Xs` →
 * `X.Xm` as the input grows. Used by job-runs / orchestrator dashboards
 * where elapsed milliseconds is the natural unit.
 *
 * Distinct from `formatDuration(seconds)` (verbose `"X hours Y minutes"`)
 * and `formatDurationMMSS(seconds)` (media timecode `MM:SS`).
 */
export function formatDurationFromMs(ms: number | null | undefined): string {
  if (!ms || isNaN(ms) || ms < 0) return '0ms'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * Format seconds to verbose human-readable duration: `"X seconds"`,
 * `"X minutes"`, `"X hours Y minutes"`. Use this for human-readable
 * spans; for media timecodes use `formatDurationMMSS`; for compact
 * media labels use `formatDurationCompact`; for elapsed milliseconds
 * use `formatDurationFromMs`.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`
}

// =============================================================================
// Text formatting helpers (proper-case, HTML strip, bio cleanup)
// =============================================================================

/**
 * Format underscore-separated text into proper case.
 *   `"self_hosted"` → `"Self Hosted"`
 *   `"open_source"` → `"Open Source"`
 */
export function formatUnderscoreText(text: string): string {
  return text
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Strip HTML tags and decode common HTML entities from a string.
 * Useful for cleaning API responses that contain HTML content.
 *
 * @example
 * stripHtml('<p>Hello <strong>World</strong></p>') // "Hello World"
 * stripHtml('Test &amp; Example') // "Test & Example"
 */
export function stripHtml(html: string): string {
  // Iterative tag-strip — a single pass is bypass-able by inputs like
  // `<scr<script>ipt>`: stripping the inner `<script>` leaves the outer
  // `<script>` reassembled. Loop until the string is stable so multi-
  // character bypasses cannot survive (CodeQL
  // `js/incomplete-multi-character-sanitization`). `<[^<>]*>` rejects
  // `<` inside the tag body so each pass is itself ReDoS-safe (no
  // backtracking on `<<<<<...<>` inputs).
  let noTags = html
  let prev: string
  do {
    prev = noTags
    noTags = noTags.replace(/<[^<>]*>/g, '')
  } while (noTags !== prev)

  // Decode entities. `&amp;` MUST come LAST so we don't double-decode
  // sequences like `&amp;lt;` (which should render as the LITERAL text
  // `&lt;`, not as `<`). All other named/numeric entities decode first;
  // only after those have been replaced do we collapse `&amp;` → `&`.
  return noTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Display label for the openmsp `vendors.classification` enum.
 * Falls back to proper-cased underscore split for values not in the
 * curated mapping.
 */
export function formatClassification(classification: string): string {
  const customMappings: Record<string, string> = {
    openframe_selected: 'OpenFrame Selected',
  }
  return customMappings[classification] || formatUnderscoreText(classification)
}

/**
 * Display label for the openmsp `vendors.pricing_model` enum.
 * Falls back to proper-cased underscore split for values not in the
 * curated mapping.
 */
export function formatPricingModel(pricingModel: string): string {
  const customMappings: Record<string, string> = {
    one_time: 'One-time Purchase',
    self_hosted: 'Self-hosted',
  }
  return customMappings[pricingModel] || formatUnderscoreText(pricingModel)
}

/**
 * Format a bio/about text from the profiles table for display.
 * Handles HTML content (e.g. `<p>` tags from rich text editors),
 * plain text passthrough, and null/undefined values.
 */
export function formatBioText(
  aboutHtml: string | null | undefined,
  fallback: string = '',
): string {
  if (!aboutHtml || !aboutHtml.trim()) return fallback

  if (aboutHtml.includes('<p')) {
    // `<p[^<>]*>` rejects `<` inside the tag so the automaton can't
    // backtrack on `<<<<<...<p>` inputs (ReDoS class fix vs. `<p[^>]*>`).
    const paragraphs = aboutHtml
      .split(/<p[^<>]*>/)
      .slice(1)
      .map((part) => part.split('</p>')[0])
      .map((text) => stripHtml(text).trim())
      .filter((text) => text.length > 0)

    if (paragraphs.length > 0) return paragraphs.join(' ')
  }

  return stripHtml(aboutHtml).trim() || fallback
}
