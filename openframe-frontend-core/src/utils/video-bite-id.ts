// Video-bite element identity — SSOT for the stable per-element `id` on
// `video_bites` / `teasers` jsonb elements (see types/video-processing.ts
// `VideoTeaser.id`) and for the ONE element-matching predicate shared by the
// hub's bite writers (`saveEntityVideoBitesResult` merge + the
// `reconcileIncomingBites` clobber guard).
//
// Isomorphic by design: runs in the admin editor (browser) and in the hub's
// Mux reconciliation sweep (Node). Zero dependencies.

/** Shape every matcher/stamper here operates on — the identity-relevant subset of VideoTeaser. */
export interface BiteIdentity {
  id?: string
  url: string
  source_url?: string
}

/** 8 lowercase hex chars. Collision-safe within one array (n≤~100 → p≈1e-6); identity is always scoped to (table, row, column). */
export const BITE_ID_RE = /^[0-9a-f]{8}$/

/** Generate a new 8-hex bite element id. */
export function generateBiteId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

/**
 * Stamp missing ids and re-stamp in-array duplicates (copy/pasted bites).
 * Returns the SAME array reference when nothing changed so callers can cheaply
 * skip persistence (`changed === false` ⇒ no write needed).
 */
export function ensureBiteIds<T extends { id?: string }>(bites: readonly T[]): { bites: T[]; changed: boolean } {
  const seen = new Set<string>()
  let changed = false
  const out = bites.map(bite => {
    const valid = typeof bite.id === 'string' && BITE_ID_RE.test(bite.id) && !seen.has(bite.id)
    if (valid) {
      seen.add(bite.id as string)
      return bite
    }
    changed = true
    let id = generateBiteId()
    while (seen.has(id)) id = generateBiteId()
    seen.add(id)
    return { ...bite, id }
  })
  return changed ? { bites: out, changed } : { bites: bites as T[], changed }
}

/**
 * The ONE element-identity predicate. Matching legs (any-of, NOT
 * short-circuit-on-id-inequality — two sides can carry DIFFERENT ids for
 * the same clip, e.g. a redelivered Vizard ingest regenerates ids):
 *   1. `id` equality — when both sides carry one and they match.
 *   2. `incoming.url === existing.url` — plain url (pre-flip stale sessions,
 *      plain re-saves).
 *   3. `incoming.url === existing.source_url` — the incoming side still holds
 *      the original storage URL of an element the Mux pipeline already flipped
 *      to HLS (redelivered ingests, stale editor arrays).
 *
 * Callers that match a whole incoming array against an existing array MUST
 * consume each existing element at most once (multiset matching) — duplicate
 * incoming urls must not all bind to one element and clone its id.
 */
export function matchBiteElement(existing: BiteIdentity, incoming: BiteIdentity): boolean {
  if (existing.id && incoming.id && existing.id === incoming.id) return true
  if (incoming.url === existing.url) return true
  if (existing.source_url && incoming.url === existing.source_url) return true
  return false
}
