/**
 * `envFlagEnabled` — THE cross-repo predicate for reading a boolean env flag.
 *
 * WHY IT LIVES HERE: the same flag is read on BOTH sides of the guide-chat
 * seam and each side had grown its own reading of it. The hub parsed the
 * value (`'0'` / `'false'` / `'off'` mean OFF); the producing app used bare
 * `Boolean(process.env.X)`, under which every non-empty string — including
 * `'0'` and `'false'` — is TRUE.
 *
 * That divergence failed OPEN on the one flag that gates a security boundary.
 * `TRUSTED_INGRESS_SETS_REAL_IP` is an operator's assertion that a reverse
 * proxy OVERWRITES the client-IP headers; without it those headers are
 * attacker-writable and must not be read. An operator writing `=0` to mean
 * "off" got the hub honoring that while the producer read `x-real-ip` /
 * `x-forwarded-for` anyway and forwarded the value as `x-chat-ip`, which the
 * hub then trusts verbatim under the service token. A rate-limit-bucket
 * spoof, reachable through a plausible operator typo.
 *
 * Both repos already depend on this package and `./chat-protocol` is its
 * server-safe subpath (no React, no browser APIs), so this is the one place
 * both sides can share — same reasoning that moved `normalizeIpForBucketKey`
 * here. Keep it as ONE definition: a second copy is what caused the drift.
 *
 * Contract:
 *   - unset, empty, or whitespace-only  → `false`;
 *   - `'0'`, `'false'`, `'off'`         → `false` (case- and
 *     surrounding-whitespace-insensitive);
 *   - any other non-empty value         → `true`.
 *
 * `process.env` is read PER CALL, never module-hoisted, so tests, preview and
 * prod all observe the live value rather than whatever was present at
 * module-eval time.
 */
export function envFlagEnabled(name: string): boolean {
  const raw = process.env[name]
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v !== '' && v !== '0' && v !== 'false' && v !== 'off'
}
