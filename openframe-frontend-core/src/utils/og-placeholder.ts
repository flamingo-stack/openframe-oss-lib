/**
 * Branded OG-placeholder URL construction — the DEFAULT cover-image fallback
 * for entity cards (onboarding guides, blog/case-study/release/etc.) that have
 * no image.
 *
 * ALL of the logic lives here, in the lib. A consumer hands over its runtime
 * `endpoints` object and NOTHING else — base resolution AND the `?title=…`
 * concatenation happen inside `buildOgPlaceholderUrl`. No host builds an
 * og-placeholder URL itself (that was the bug this replaced: each embedder
 * wired a per-surface callback that concatenated the URL, and a host that
 * forgot it rendered a blank slot with no request).
 *
 * The base API URL is taken from the endpoints the host already configures:
 *   1. explicit `endpoints.ogPlaceholderUrl`
 *   2. derived from the sibling `endpoints.imageProxyUrlPrefix` (same API base)
 *   3. same-origin relative `/api/og-placeholder`
 * The hub bakes its per-platform brand colors + site into `ogPlaceholderUrl`
 * (as query params); they're preserved and `title` (+ dimensions) are layered
 * on top.
 */

/** The slice of `ChatRuntime.endpoints` this module needs. */
export interface OgPlaceholderEndpoints {
  /** Explicit base URL for the og-placeholder route. May already carry query
   *  params (the hub bakes brand colors + site here) — they're preserved. */
  ogPlaceholderUrl?: string
  /** Sibling image route under the SAME API base. When `ogPlaceholderUrl` is
   *  unset, the base is derived from this by swapping the trailing
   *  `/image-proxy` segment for `/og-placeholder` — so a host that already
   *  proxies images gets the placeholder for free, with zero extra wiring. */
  imageProxyUrlPrefix?: string
}

export interface BuildOgPlaceholderOptions {
  /** Site name shown under the title. Skipped when empty. */
  site?: string
  /** `'wide'` (1200×630, the route default — no `w`/`h` emitted) or
   *  `'square'` (1024×1024, for compact 56×56 chat-inline slots). */
  aspect?: 'wide' | 'square'
  /** Explicit pixel overrides (win over `aspect`). */
  width?: number
  height?: number
}

/** Same-origin default — for hosts that serve the route themselves (the hub).
 *  Cross-origin embedders override via `ogPlaceholderUrl` or inherit it from
 *  `imageProxyUrlPrefix`. */
const DEFAULT_OG_PLACEHOLDER_PATH = '/api/og-placeholder'

/** Resolve the og-placeholder route base from the host's endpoints.
 *  Internal — callers go through `buildOgPlaceholderUrl(endpoints, …)`. */
function resolveOgPlaceholderBase(endpoints?: OgPlaceholderEndpoints | null): string {
  if (endpoints?.ogPlaceholderUrl) return endpoints.ogPlaceholderUrl
  const imageProxy = endpoints?.imageProxyUrlPrefix
  if (imageProxy) {
    // `/image-proxy` and `/og-placeholder` are sibling API routes under one
    // base. Anchor to a path-segment boundary so we only rewrite the route
    // name, never an incidental substring.
    const derived = imageProxy.replace(/\/image-proxy(?=$|[?/])/, '/og-placeholder')
    if (derived !== imageProxy) return derived
  }
  return DEFAULT_OG_PLACEHOLDER_PATH
}

/**
 * Build the branded og-placeholder image URL from the host's `endpoints` + a
 * title. This is the ONLY entry point: it resolves the route base from
 * `endpoints` AND concatenates `title` (+ dimensions), so a consumer never
 * constructs a URL itself.
 *
 * Pure string construction — SSR- and browser-safe. Always returns a usable
 * URL (relative default at worst), so a missing/unknown image degrades
 * gracefully via the `<img onError>` recovery in the card components.
 */
export function buildOgPlaceholderUrl(
  endpoints: OgPlaceholderEndpoints | null | undefined,
  title: string,
  options: BuildOgPlaceholderOptions = {},
): string {
  const base = resolveOgPlaceholderBase(endpoints)
  const qIndex = base.indexOf('?')
  const path = qIndex === -1 ? base : base.slice(0, qIndex)
  const params = new URLSearchParams(qIndex === -1 ? '' : base.slice(qIndex + 1))

  params.set('title', title)
  if (options.site) params.set('site', options.site)

  // Square aspect → request a 1024×1024 image so `object-cover` doesn't crop
  // the title off in compact slots. Wide leaves dimensions to the route
  // default (1200×630). Explicit width/height always win.
  const width = options.width ?? (options.aspect === 'square' ? 1024 : undefined)
  const height = options.height ?? (options.aspect === 'square' ? 1024 : undefined)
  if (typeof width === 'number' && Number.isFinite(width)) params.set('w', String(width))
  if (typeof height === 'number' && Number.isFinite(height)) params.set('h', String(height))

  return `${path}?${params.toString()}`
}
