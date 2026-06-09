/**
 * Humanity signals — invisible bot-protection primitives shared by the lib's
 * public forms (client) and the hub's per-route `verifyHuman` gate (server).
 *
 * PURE + React-free on purpose: this module is a tsup SERVER entry (no
 * "use client" banner) so the hub can import it server-side without pulling a
 * client-reference boundary — same pattern as `schemas/contact-schema` and
 * `components/features/mux-origins`.
 *
 * Two origin-independent signals travel in the POST body: a honeypot (a hidden
 * field real users never fill) and timing (ms from form mount to submit).
 * `evaluateHumanitySignals` is the SINGLE source of truth for the block/allow
 * decision — the hub imports + calls it rather than re-implementing the rules.
 */

/** Hidden honeypot field name. Innocuous + autofill-resistant (deliberately NOT name/email). */
export const HONEYPOT_FIELD = 'contact_url_confirm'
/** Client-measured ms between form mount and submit. */
export const ELAPSED_MS_FIELD = 'form_elapsed_ms'
/** Default minimum fill time (ms). A submit faster than this is treated as a bot. */
export const DEFAULT_MIN_FILL_MS = 700

/** Keyed wire object produced by `useHumanitySignals().getSignals()` and spread into the POST body. */
export type HumanitySignals = Record<string, string | number>

/** Result of {@link evaluateHumanitySignals}. */
export type HumanityVerdict = { ok: true } | { ok: false; reason: 'honeypot' | 'too_fast' }

/** Tolerant reader — never throws; missing/garbage timing → null. */
export function extractHumanitySignals(body: unknown): { honeypot: string; elapsedMs: number | null } {
  const b = (body ?? {}) as Record<string, unknown>
  const rawHp = b[HONEYPOT_FIELD]
  // A legit client always sends a STRING here (getSignals → ref.value ?? ''),
  // so ANY present non-string value is a bot filling the decoy with a non-string
  // to dodge the empty-check — coerce to a (non-empty) string so it still trips.
  // null/undefined → '' = the correct "field absent / unfilled" allow case.
  const honeypot = rawHp == null ? '' : String(rawHp)
  const rawMs = b[ELAPSED_MS_FIELD]
  const elapsedMs = typeof rawMs === 'number' && Number.isFinite(rawMs) ? rawMs : null
  return { honeypot, elapsedMs }
}

/**
 * SINGLE decision fn for honeypot + timing (the hub's `verifyHuman` imports + calls this):
 * - honeypot non-empty → bot (real users never fill the off-screen field)
 * - elapsed below `minFillMs` → bot (humans take time; a MISSING timing value never blocks)
 */
export function evaluateHumanitySignals(body: unknown, opts: { minFillMs: number }): HumanityVerdict {
  const { honeypot, elapsedMs } = extractHumanitySignals(body)
  if (honeypot.trim() !== '') return { ok: false, reason: 'honeypot' }
  if (elapsedMs !== null && elapsedMs < opts.minFillMs) return { ok: false, reason: 'too_fast' }
  return { ok: true }
}

/** Parse a comma-separated env string → trimmed, non-empty entries (undefined → []). */
export const splitCsvEnv = (s?: string): string[] =>
  s?.split(',').map((t) => t.trim()).filter(Boolean) ?? []
