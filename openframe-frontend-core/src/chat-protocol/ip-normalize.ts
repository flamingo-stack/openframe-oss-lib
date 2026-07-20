/**
 * `normalizeIpForBucketKey` — THE cross-repo normalizer for turning a raw
 * client-IP candidate (`x-forwarded-for` hop, socket remote address, proxy
 * header) into a stable rate-limit / dedup bucket key.
 *
 * WHY IT LIVES HERE: producer and consumer sit in DIFFERENT repos (the app
 * emits the candidate, the hub buckets it) and each had grown its own
 * normalizer. They disagreed — one unwrapped `::ffff:1.2.3.4` to the bare
 * IPv4 and stripped `%zone`, the other kept the zone and only lower-cased the
 * mapped form — so ONE visitor could land in TWO buckets depending on which
 * side normalized. Both repos already depend on this package, and
 * `./chat-protocol` is its server-safe subpath (no React, no browser APIs),
 * so this is the one place both sides can share.
 *
 * Contract:
 *   - input longer than `IP_BUCKET_KEY_MAX_LENGTH` → `null` (an unbounded
 *     header must never become an unbounded map key);
 *   - `[…]` brackets and a trailing `]:port` are stripped, as is a bare
 *     `:port` on an IPv4 (`203.0.113.4:8080`) — an unbracketed IPv6 with a
 *     bare port stays ambiguous and is not stripped;
 *   - a `%zone` suffix is stripped (link-local scope is per-host, not part of
 *     the peer's identity);
 *   - IPv4-mapped IPv6 (`::ffff:203.0.113.4`) collapses to the bare IPv4, so
 *     the same peer buckets identically over either stack;
 *   - IPv6 is lower-cased;
 *   - IPv4 octets are range-checked and REJECTED when zero-padded (`.04`
 *     would otherwise bucket separately from `.4`), and IPv6 is
 *     charset/shape-checked (one `::` at most, ≤8 groups, an embedded IPv4
 *     only in the last group, no dangling separator); anything else returns
 *     `null` rather than a junk bucket key.
 *
 * It does NOT canonicalize IPv6 zero-compression (`2001:db8::1` vs
 * `2001:0db8:0:0:0:0:0:1`) — peers do not spell their own address two ways
 * within one deployment, and a full expander is more surface than the bucket
 * key warrants.
 */

/** Longest accepted candidate. A full IPv6 + zone fits well inside this. */
export const IP_BUCKET_KEY_MAX_LENGTH = 64

function isIpv4(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 4) return false
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false
    // Leading zeros are a SECOND spelling of the same address (`203.0.113.04`),
    // so accepting them verbatim splits one peer across two buckets. Reject
    // rather than canonicalize: no legitimate emitter zero-pads, and some
    // resolvers read a `0`-prefixed octet as octal, i.e. it is not even
    // reliably the same address.
    if (part.length > 1 && part.startsWith('0')) return false
    if (Number(part) > 255) return false
  }
  return true
}

function isIpv6(value: string): boolean {
  if (!value.includes(':')) return false
  // Charset gate first: hex digits, separators, and the dots of a trailing
  // embedded IPv4. Anything else (a hostname, a header injection) is out.
  if (!/^[0-9a-f:.]+$/.test(value)) return false
  if (value.includes(':::')) return false
  // A dangling separator (`2001:db8::1:`) leaves an EMPTY trailing group that
  // is not part of a `::` compression — malformed, not an address.
  if (value.endsWith(':') && !value.endsWith('::')) return false
  if (value.startsWith(':') && !value.startsWith('::')) return false
  const compressions = value.split('::').length - 1
  if (compressions > 1) return false
  const groups = value.split(':')
  if (groups.length > 8) return false
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i]
    if (group === '') continue
    if (group.includes('.')) {
      // An embedded IPv4 occupies the LAST two groups; anywhere else
      // (`1.2.3.4::1`) it is malformed.
      if (i !== groups.length - 1) return false
      if (!isIpv4(group)) return false
      continue
    }
    if (!/^[0-9a-f]{1,4}$/.test(group)) return false
  }
  // Uncompressed form must be exactly 8 groups (a trailing embedded IPv4
  // occupies two, so 7 written groups is also complete).
  if (compressions === 0) {
    const embedsIpv4 = groups[groups.length - 1]?.includes('.') ?? false
    if (groups.length !== (embedsIpv4 ? 7 : 8)) return false
  }
  return true
}

/**
 * Normalize one IP candidate to its canonical bucket key, or `null` when the
 * value is not a usable address.
 */
export function normalizeIpForBucketKey(value: string): string | null {
  if (typeof value !== 'string') return null
  let candidate = value.trim()
  if (candidate === '' || candidate.length > IP_BUCKET_KEY_MAX_LENGTH) return null

  // `[2001:db8::1]` / `[::1]:443` — the bracketed forms a proxy emits so the
  // port is unambiguous.
  if (candidate.startsWith('[')) {
    const close = candidate.indexOf(']')
    if (close === -1) return null
    const trailer = candidate.slice(close + 1)
    if (trailer !== '' && !/^:\d{1,5}$/.test(trailer)) return null
    candidate = candidate.slice(1, close)
  }

  // `%eth0` / `%25eth0` scope id — host-local, never part of peer identity.
  const zone = candidate.indexOf('%')
  if (zone !== -1) candidate = candidate.slice(0, zone)
  if (candidate === '') return null

  // UNBRACKETED `203.0.113.4:8080` — Azure App Service / Front Door and several
  // CDNs write the client hop that way. Rejecting it left the caller with NO
  // candidate at all, collapsing every visitor into the single egress bucket:
  // exactly the silent regression this module exists to prevent. Stripped ONLY
  // when the remainder is a valid IPv4; an unbracketed IPv6 with a bare port
  // (`::1:443`) is genuinely ambiguous — `:443` is equally a final group — so
  // that shape is left to the IPv6 path.
  const portSplit = candidate.lastIndexOf(':')
  if (portSplit > 0 && /^\d{1,5}$/.test(candidate.slice(portSplit + 1))) {
    const head = candidate.slice(0, portSplit)
    if (isIpv4(head)) candidate = head
  }

  if (isIpv4(candidate)) return candidate

  const lowered = candidate.toLowerCase()

  // IPv4-mapped IPv6 → the bare IPv4 (same peer, one bucket). EVERY spelling
  // is handled: the compressed `::ffff:1.2.3.4` that dual-stack listeners
  // actually emit, the written-out `0:0:0:0:0:ffff:1.2.3.4` that a hop doing
  // its own (non-compressing) formatting can produce, and the ZERO-PADDED
  // `0000:0000:0000:0000:0000:ffff:1.2.3.4` that a fixed-width formatter
  // produces — leading zeros in an IPv6 group are purely cosmetic, so all
  // three name the same peer. Matching only some of them would split one peer
  // across two buckets — the exact failure this module exists to prevent.
  const mapped = /^(?:(?:0{1,4}:){5}|::)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lowered)
  if (mapped) return isIpv4(mapped[1]) ? mapped[1] : null

  if (isIpv6(lowered)) return lowered
  return null
}
