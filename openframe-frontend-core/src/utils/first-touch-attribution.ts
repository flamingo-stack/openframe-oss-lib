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
 * SESSION-SCOPED, deliberately and without an opt-out. Three reasons:
 *  - first-touch attribution for a single visit is the useful signal;
 *  - a session record does not persist an identifier across visits, which keeps this out of
 *    consent-banner territory;
 *  - `sessionStorage` is per-tab, so `load()`-then-`save()` cannot race another tab.
 *    `localStorage` is shared, so two tabs opening simultaneously could both observe no
 *    record and the second write would silently replace the first — breaking the one
 *    invariant this module exists to hold. Web Storage has no compare-and-swap, so that race
 *    cannot be closed reliably; the option is therefore not offered rather than offered with
 *    a caveat. If cross-session persistence is ever needed it belongs in a server-side
 *    cookie, where it can be written atomically.
 *
 * NEVER STORES A RAW URL. See `sanitizeLandingUrl`.
 */

import { createLocalStorageAdapter } from './local-storage-adapter';

/** Attribution parameters worth carrying from the landing URL to the submit body. */
export interface FirstTouchAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** Reddit Ads click id. */
  rdt_cid?: string;
  /**
   * The landing PAGE — `origin + pathname` only. Never the query string or fragment.
   * See `sanitizeLandingUrl` for why.
   */
  landing_url?: string;
  /** ISO timestamp of first capture, for debugging stale records. */
  captured_at?: string;
}

export const FIRST_TOUCH_ATTRIBUTION_KEY = 'of.first_touch_attribution';

const TRACKED_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'rdt_cid'] as const;

/** Every key this module is allowed to store or replay. */
const ALLOWED_KEYS: ReadonlySet<string> = new Set<string>([...TRACKED_PARAMS, 'landing_url', 'captured_at']);

/**
 * Reduce a URL to `origin + pathname`.
 *
 * The raw `window.location.href` must NEVER be stored or replayed. It routinely carries
 * things that have nothing to do with attribution and everything to do with security: OAuth
 * `code`/`state`, magic-link and password-reset tokens, `access_token` in the fragment,
 * email addresses and other PII in query params. This value is spread into every submit body,
 * so anything kept here would be POSTed to our API and forwarded on to HubSpot — a token in
 * a CRM record is a token in every integration downstream of it.
 *
 * The path alone answers the only question worth asking ("which page did they land on"), so
 * the query and fragment are dropped wholesale rather than filtered. An allowlist of "safe"
 * params would need updating every time a new auth flow adds one; dropping everything cannot
 * go stale.
 */
export function sanitizeLandingUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    // Non-http(s) schemes have no meaningful landing page.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

function makeAdapter() {
  return createLocalStorageAdapter<FirstTouchAttribution>({
    key: FIRST_TOUCH_ATTRIBUTION_KEY,
    backend: 'session',
    logTag: '[first-touch-attribution]',
    // Anything running on this origin can write to sessionStorage, and whatever `load()`
    // returns is spread into submit bodies. So the stored shape is validated, not assumed:
    // allowlisted keys only, string values only. Without this a malformed or planted record
    // would inject arbitrary keys into an API payload.
    validate: (parsed): parsed is FirstTouchAttribution => {
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
      return Object.entries(parsed as Record<string, unknown>).every(
        ([key, value]) => ALLOWED_KEYS.has(key) && typeof value === 'string',
      );
    },
  });
}

/** Parse the tracked parameters out of a URL. Returns `{}` when none are present. */
export function parseAttributionFromUrl(url: string): FirstTouchAttribution {
  const out: FirstTouchAttribution = {};
  try {
    const parsed = new URL(url);
    for (const param of TRACKED_PARAMS) {
      const value = parsed.searchParams.get(param);
      if (value && value.trim()) out[param] = value.trim();
    }
  } catch {
    return {};
  }
  return out;
}

/**
 * Record the landing URL's attribution if nothing is stored yet.
 *
 * Idempotent and first-touch-preserving: a later call with different parameters is ignored.
 * Safe to call on every page view, and a no-op during SSR.
 *
 * @returns what is VERIFIABLY stored after the call — a pre-existing record, the new record
 *   read back from storage, or `{}` when nothing was captured or the write did not stick.
 */
export function captureFirstTouchAttribution(options: { url?: string } = {}): FirstTouchAttribution {
  if (typeof window === 'undefined') return {};

  const adapter = makeAdapter();
  const existing = adapter.load();
  if (existing && Object.keys(existing).length > 0) return existing;

  const href = options.url ?? window.location.href;
  const parsed = parseAttributionFromUrl(href);
  if (Object.keys(parsed).length === 0) return {};

  const landingUrl = sanitizeLandingUrl(href);
  const record: FirstTouchAttribution = {
    ...parsed,
    ...(landingUrl ? { landing_url: landingUrl } : {}),
    captured_at: new Date().toISOString(),
  };
  adapter.save(record);

  // Confirm it PERSISTED before reporting success. `save()` returns void and swallows its
  // errors, so in blocked or quota-exceeded storage (Safari private mode, a full quota) the
  // write silently no-ops. Returning `record` there would hand the caller data that no
  // subsequent `getFirstTouchAttribution()` can recover — the caller would replay
  // attribution on this page view and none on the next, which is worse than replaying none
  // at all because it looks like it worked.
  return adapter.load() ?? {};
}

/** Read the stored attribution. `{}` when nothing was captured or during SSR. */
export function getFirstTouchAttribution(): FirstTouchAttribution {
  if (typeof window === 'undefined') return {};
  return makeAdapter().load() ?? {};
}

/**
 * Merge stored attribution into a submit body.
 *
 * Values already on the body WIN — a form that collected a real value explicitly should not
 * be overwritten by a stored one. Spread this into every submit payload:
 *
 *   body: JSON.stringify(withFirstTouchAttribution({ email, name }))
 */
export function withFirstTouchAttribution<T extends Record<string, unknown>>(body: T): T & FirstTouchAttribution {
  const stored = getFirstTouchAttribution();
  const merged: Record<string, unknown> = { ...stored, ...body };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === '') delete merged[k];
  }
  return merged as T & FirstTouchAttribution;
}

/** Clear the stored record. Exposed for tests and for a consent-withdrawal path. */
export function clearFirstTouchAttribution(): void {
  if (typeof window === 'undefined') return;
  makeAdapter().clear();
}
