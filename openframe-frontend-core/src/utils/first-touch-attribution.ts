/**
 * First-touch attribution capture.
 *
 * THE PROBLEM. Server-side UTM extraction reads the request body and, failing that, UTM
 * params on the `referer` header. But `referer` is the page the form was submitted FROM, and
 * a visitor who lands on `/?utm_source=reddit` and then navigates before converting arrives
 * with a clean referer. Measured on the live DB: waitlist rows from the last 90 days have
 * `ip_address` on 350/350 and `utm_source` on **0/350**. The parameters are not being lost in
 * transit; they are gone by submit time.
 *
 * THE FIX. Capture the landing URL's attribution ONCE, on first page view, and replay it into
 * every submit body from then on. The server already prefers body-supplied UTMs over the
 * referer, so nothing changes server-side.
 *
 * FIRST touch, not last: `capture()` never overwrites an existing record, so a visitor who
 * lands on an ad and later arrives via a bookmark keeps the ad attribution.
 *
 * Built on `createLocalStorageAdapter` so there is no hand-rolled Web Storage access and no
 * module-scope `window` — `./utils` is imported by server-safe consumers, so touching
 * `window` at module scope would break SSR.
 *
 * BACKEND: `session` by default. First-touch attribution for a single visit is the useful
 * signal, and a session-scoped record avoids persisting an identifier across visits, which
 * keeps this out of consent-banner territory. Pass `backend: 'local'` only with an explicit
 * decision to persist across sessions.
 */

import { createLocalStorageAdapter, type WebStorageBackend } from './local-storage-adapter'

/** Attribution parameters worth carrying from the landing URL to the submit body. */
export interface FirstTouchAttribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  /** Reddit Ads click id. */
  rdt_cid?: string
  /** The landing URL itself, so first-touch page attribution survives too. */
  landing_url?: string
  /** ISO timestamp of first capture, for debugging stale records. */
  captured_at?: string
}

export const FIRST_TOUCH_ATTRIBUTION_KEY = 'of.first_touch_attribution'

const TRACKED_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'rdt_cid',
] as const

function makeAdapter(backend: WebStorageBackend = 'session') {
  return createLocalStorageAdapter<FirstTouchAttribution>({
    key: FIRST_TOUCH_ATTRIBUTION_KEY,
    backend,
    logTag: '[first-touch-attribution]',
    validate: (parsed): parsed is FirstTouchAttribution =>
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed),
  })
}

/** Parse the tracked parameters out of a URL. Returns `{}` when none are present. */
export function parseAttributionFromUrl(url: string): FirstTouchAttribution {
  const out: FirstTouchAttribution = {}
  try {
    const parsed = new URL(url)
    for (const param of TRACKED_PARAMS) {
      const value = parsed.searchParams.get(param)
      if (value && value.trim()) out[param] = value.trim()
    }
  } catch {
    return {}
  }
  return out
}

/**
 * Record the landing URL's attribution if nothing is stored yet.
 *
 * Idempotent and first-touch-preserving: a later call with different parameters is ignored.
 * Safe to call on every page view, and a no-op during SSR.
 *
 * @returns what is stored after the call (possibly a pre-existing record).
 */
export function captureFirstTouchAttribution(
  options: { url?: string; backend?: WebStorageBackend } = {},
): FirstTouchAttribution {
  if (typeof window === 'undefined') return {}

  const adapter = makeAdapter(options.backend)
  const existing = adapter.load()
  if (existing && Object.keys(existing).length > 0) return existing

  const parsed = parseAttributionFromUrl(options.url ?? window.location.href)
  if (Object.keys(parsed).length === 0) return {}

  const record: FirstTouchAttribution = {
    ...parsed,
    landing_url: options.url ?? window.location.href,
    captured_at: new Date().toISOString(),
  }
  adapter.save(record)
  return record
}

/** Read the stored attribution. `{}` when nothing was captured or during SSR. */
export function getFirstTouchAttribution(
  options: { backend?: WebStorageBackend } = {},
): FirstTouchAttribution {
  if (typeof window === 'undefined') return {}
  return makeAdapter(options.backend).load() ?? {}
}

/**
 * Merge stored attribution into a submit body.
 *
 * Values already on the body WIN — a form that collected a real value explicitly should not
 * be overwritten by a stored one. Spread this into every submit payload:
 *
 *   body: JSON.stringify(withFirstTouchAttribution({ email, name }))
 */
export function withFirstTouchAttribution<T extends Record<string, any>>(
  body: T,
  options: { backend?: WebStorageBackend } = {},
): T & FirstTouchAttribution {
  const stored = getFirstTouchAttribution(options)
  const merged: Record<string, any> = { ...stored, ...body }
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === '') delete merged[k]
  }
  return merged as T & FirstTouchAttribution
}

/** Clear the stored record. Exposed for tests and for a consent-withdrawal path. */
export function clearFirstTouchAttribution(options: { backend?: WebStorageBackend } = {}): void {
  if (typeof window === 'undefined') return
  makeAdapter(options.backend).clear()
}
