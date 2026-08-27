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
 *
 * FALSE-POSITIVE HISTORY (2026-08-27): the honeypot was named
 * `contact_url_confirm`, and browser/password-manager autofill (which ignores
 * `autocomplete="off"` and matches "url"/"confirm" name heuristics) filled it
 * for REAL users — every production `BOT_DETECTED` in the log window was a
 * legitimate Chrome user whose autofill tripped the decoy. Three layers now
 * prevent a recurrence; keep all three when touching this system:
 *   1. The field name avoids every autofill-heuristic token (name/email/
 *      phone/url/website/confirm/company/address/code/…).
 *   2. `HoneypotField` renders `readOnly`-until-focus + password-manager
 *      ignore attributes — autofill skips read-only inputs.
 *   3. `evaluateHumanitySignals` forgives a filled decoy whose value was
 *      COPIED from another field in the same body (the autofill signature —
 *      a human, not a bot). See `findHoneypotCopySource` for the match rules.
 *
 * ACCEPTED TRADEOFF of layer 3 (do not "fix" by removing the forgiveness): a
 * bot that fills EVERY field with one identical value now passes the honeypot
 * check. That bot class always had a strictly easier evasion — send the decoy
 * empty — so no new attacker capability is admitted; it remains covered by the
 * timing check, per-IP rate limits, route Zod validation, and first-party
 * BotID. Every forgiven allow is warn-logged by the hub gate for monitoring.
 */

/** Hidden honeypot field name. Deliberately free of autofill-heuristic tokens (see module doc). */
export const HONEYPOT_FIELD = 'form_extra_note';
/**
 * Prior honeypot field name — still EVALUATED (a stale-lib embedder's client
 * keeps its bot protection) and still STRIPPED before upstream forwarding.
 * Remove once the hub gate's `field=legacy` log lines stop appearing (every
 * deployed embedder ships a lib newer than the rename).
 */
export const LEGACY_HONEYPOT_FIELD = 'contact_url_confirm';
/** Client-measured ms between form mount and submit. */
export const ELAPSED_MS_FIELD = 'form_elapsed_ms';
/** Default minimum fill time (ms). A submit faster than this is treated as a bot. */
export const DEFAULT_MIN_FILL_MS = 700;

/**
 * Every humanity-signal key that rides in a public form's POST body.
 * Server-side handlers that forward form payloads upstream (HubSpot booking,
 * CRM pushes, …) MUST strip by THIS array — never hand-typed strings — so a
 * field rename here propagates everywhere and the honeypot value can never
 * silently leak into an upstream record.
 */
export const HUMANITY_SIGNAL_KEYS = [HONEYPOT_FIELD, LEGACY_HONEYPOT_FIELD, ELAPSED_MS_FIELD] as const;

/** Is this body key one of the humanity-signal wire fields? */
export const isHumanitySignalKey = (key: string): boolean => (HUMANITY_SIGNAL_KEYS as readonly string[]).includes(key);

/** Keyed wire object produced by `useHumanitySignals().getSignals()` and spread into the POST body. */
export type HumanitySignals = Record<string, string | number>;

/**
 * Diagnostics every verdict carries so callers LOG what this module already
 * computed instead of re-deriving it (a re-derived predicate silently diverges
 * the day the rules here change):
 * - `honeypotLength`/`honeypotField`: decoy length + which wire field carried
 *   it — never the typed value (log-safe by construction).
 * - `timingAffirmed`: the submission POSITIVELY proved human timing (a PRESENT
 *   elapsed-ms at/above the floor — merely-missing timing does not affirm).
 *   The hub gate keys its BotID form-downgrade on this.
 */
export type HumanityVerdictDiagnostics = {
  honeypotLength: number;
  honeypotField: HoneypotFieldProvenance;
  timingAffirmed: boolean;
};

/** Result of {@link evaluateHumanitySignals}. */
export type HumanityVerdict = HumanityVerdictDiagnostics &
  (
    | {
        ok: true;
        /** Present when a filled decoy was forgiven as autofill; `sourceField` names the body field it was copied from. */
        note?: 'honeypot_autofill';
        sourceField?: string;
      }
    | { ok: false; reason: 'honeypot' | 'too_fast' }
  );

/** Which wire field the honeypot value was read from (log/monitoring only — see LEGACY_HONEYPOT_FIELD). */
export type HoneypotFieldProvenance = 'current' | 'legacy' | null;

/** Tolerant reader — never throws; missing/garbage timing → null. */
export function extractHumanitySignals(body: unknown): {
  honeypot: string;
  elapsedMs: number | null;
  honeypotField: HoneypotFieldProvenance;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  // Current field name first; a stale-lib client still posts the legacy name.
  const honeypotField: HoneypotFieldProvenance =
    b[HONEYPOT_FIELD] != null ? 'current' : b[LEGACY_HONEYPOT_FIELD] != null ? 'legacy' : null;
  const rawHp = honeypotField === 'legacy' ? b[LEGACY_HONEYPOT_FIELD] : b[HONEYPOT_FIELD];
  // A legit client always sends a STRING here (getSignals → ref.value ?? ''),
  // so ANY present non-string value is a bot dodging the empty-check — coerce
  // to a NON-EMPTY string so it still trips (JSON.stringify keeps `[]`/`{}`
  // non-empty where String() would collapse them to '').
  // null/undefined → '' = the correct "field absent / unfilled" allow case.
  const honeypot = rawHp == null ? '' : typeof rawHp === 'string' ? rawHp : (JSON.stringify(rawHp) ?? String(rawHp));
  const rawMs = b[ELAPSED_MS_FIELD];
  const elapsedMs = typeof rawMs === 'number' && Number.isFinite(rawMs) ? rawMs : null;
  return { honeypot, elapsedMs, honeypotField };
}

/**
 * Comparison normalization for the copy-match: autofill may fill the decoy
 * with a differently-FORMATTED rendition of the value the client posts (the
 * waitlist normalizes phones to E.164 before POST while a manager fills the
 * stored "(555) 123-4567"), so exact equality misses real humans. Normalized
 * equality still requires the decoy to mirror a real field's CONTENT, which a
 * bot gains nothing from — it could always send the decoy empty instead.
 */
const normalizeForCopyMatch = (s: string): string => s.normalize('NFKC').trim().toLowerCase();
const digitsOf = (s: string): string => s.replace(/\D/g, '');

/** Minimum normalized length for a copy-match — a 1-char echo is coincidence, not autofill. */
const MIN_COPY_MATCH_LENGTH = 2;
/** Digits-only phone matching needs a real phone-sized run to be meaningful. */
const MIN_PHONE_DIGITS = 7;

/**
 * Phone-sized digit runs match when one ENDS WITH the other: a manager fills
 * the stored national format ("(555) 123-4567") while the client posts E.164
 * ("+15551234567") — same phone, differing only by the country-code prefix.
 */
const phoneDigitsMatch = (a: string, b: string): boolean =>
  a.length >= MIN_PHONE_DIGITS && b.length >= MIN_PHONE_DIGITS && (a.endsWith(b) || b.endsWith(a));

/**
 * Find the body field the decoy value was COPIED from — the autofill
 * signature: browsers and password-manager extensions fill the hidden input
 * with the same datum they put in a visible field (email, phone, …) — a human
 * with autofill, not a bot. Scans top-level string values, string arrays, and
 * one nested level (the booking form's custom `formFields` object). Matches
 * normalized equality, plus digits-only equality for phone-sized values.
 *
 * Returns the matched field's path (`email`, `formFields.phone`, `tags[]`) —
 * the SSOT for both the verdict and the hub gate's `sameAs` log diagnostic —
 * or `null` when nothing matches.
 */
export function findHoneypotCopySource(body: unknown, honeypot: string): string | null {
  const hpNorm = normalizeForCopyMatch(honeypot);
  const hpDigits = digitsOf(honeypot);
  const phoneCandidate = hpDigits.length >= MIN_PHONE_DIGITS;
  if (hpNorm.length < MIN_COPY_MATCH_LENGTH && !phoneCandidate) return null;

  const matches = (value: unknown): boolean => {
    if (typeof value !== 'string' || value.trim() === '') return false;
    // No length re-check: the top guard already rejected sub-minimum values
    // (phoneCandidate implies ≥7 chars survive normalization — digits do).
    if (normalizeForCopyMatch(value) === hpNorm) return true;
    return phoneCandidate && phoneDigitsMatch(digitsOf(value), hpDigits);
  };
  const matchInArray = (value: unknown): boolean => Array.isArray(value) && value.some(matches);

  const b = (body ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(b)) {
    if (isHumanitySignalKey(key)) continue;
    if (matches(value)) return key;
    if (matchInArray(value)) return `${key}[]`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nested] of Object.entries(value as Record<string, unknown>)) {
        if (matches(nested)) return `${key}.${nestedKey}`;
        if (matchInArray(nested)) return `${key}.${nestedKey}[]`;
      }
    }
  }
  return null;
}

/**
 * SINGLE decision fn for honeypot + timing (the hub's `verifyHuman` imports + calls this):
 * - honeypot non-empty → bot (real users never fill the off-screen field) — UNLESS the
 *   value was copied from another field in the body (autofill reached the decoy → human;
 *   the verdict carries `note: 'honeypot_autofill'` + the `sourceField` so callers log it)
 * - elapsed below `minFillMs` → bot (humans take time; a MISSING timing value never
 *   blocks — and the too-fast check still applies to autofill-forgiven submissions)
 */
export function evaluateHumanitySignals(body: unknown, opts: { minFillMs: number }): HumanityVerdict {
  const { honeypot, elapsedMs, honeypotField } = extractHumanitySignals(body);
  const diagnostics: HumanityVerdictDiagnostics = {
    honeypotLength: honeypot.length,
    honeypotField,
    timingAffirmed: elapsedMs !== null && elapsedMs >= opts.minFillMs,
  };
  const filled = honeypot.trim() !== '';
  const sourceField = filled ? findHoneypotCopySource(body, honeypot) : null;
  if (filled && sourceField === null) return { ...diagnostics, ok: false, reason: 'honeypot' };
  if (elapsedMs !== null && elapsedMs < opts.minFillMs) return { ...diagnostics, ok: false, reason: 'too_fast' };
  return sourceField !== null
    ? { ...diagnostics, ok: true, note: 'honeypot_autofill', sourceField }
    : { ...diagnostics, ok: true };
}

/** Parse a comma-separated env string → trimmed, non-empty entries (undefined → []). */
export const splitCsvEnv = (s?: string): string[] =>
  s
    ?.split(',')
    .map(t => t.trim())
    .filter(Boolean) ?? [];
