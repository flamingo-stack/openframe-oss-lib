import { describe, it, expect } from 'vitest'
import { normalizeIpForBucketKey, IP_BUCKET_KEY_MAX_LENGTH } from '../ip-normalize'

describe('normalizeIpForBucketKey', () => {
  it('passes plain IPv4 through', () => {
    expect(normalizeIpForBucketKey('203.0.113.4')).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey('  203.0.113.4  ')).toBe('203.0.113.4')
  })

  it('range-checks IPv4 octets', () => {
    expect(normalizeIpForBucketKey('203.0.113.256')).toBeNull()
    expect(normalizeIpForBucketKey('203.0.113')).toBeNull()
    expect(normalizeIpForBucketKey('203.0.113.4.5')).toBeNull()
  })

  it('unwraps IPv4-mapped IPv6 to the bare IPv4 (one peer, one bucket)', () => {
    expect(normalizeIpForBucketKey('::ffff:203.0.113.4')).toBe('203.0.113.4')
    // Written-out spelling of the SAME mapped address must land in the same
    // bucket — a hop that formats without zero-compression would otherwise
    // split one peer in two.
    expect(normalizeIpForBucketKey('0:0:0:0:0:ffff:203.0.113.4')).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey('0:0:0:0:0:FFFF:203.0.113.4')).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey('0:0:0:0:0:ffff:203.0.113.999')).toBeNull()
    expect(normalizeIpForBucketKey('::FFFF:203.0.113.4')).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey('[::ffff:203.0.113.4]:443')).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey('::ffff:203.0.113.999')).toBeNull()
  })

  it('strips brackets and a trailing port', () => {
    expect(normalizeIpForBucketKey('[::1]:443')).toBe('::1')
    expect(normalizeIpForBucketKey('[2001:db8::1]')).toBe('2001:db8::1')
    // Unbalanced / junk trailer is not an address.
    expect(normalizeIpForBucketKey('[::1')).toBeNull()
    expect(normalizeIpForBucketKey('[::1]junk')).toBeNull()
  })

  it('strips the %zone scope id', () => {
    expect(normalizeIpForBucketKey('fe80::1%eth0')).toBe('fe80::1')
    expect(normalizeIpForBucketKey('[fe80::1%25eth0]:9000')).toBe('fe80::1')
    expect(normalizeIpForBucketKey('%eth0')).toBeNull()
  })

  it('lower-cases IPv6 so casing cannot split a bucket', () => {
    expect(normalizeIpForBucketKey('2001:DB8::AB')).toBe('2001:db8::ab')
    expect(normalizeIpForBucketKey('2001:db8::ab')).toBe('2001:db8::ab')
  })

  it('accepts full and compressed IPv6 shapes', () => {
    expect(normalizeIpForBucketKey('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(
      '2001:0db8:0000:0000:0000:0000:0000:0001',
    )
    expect(normalizeIpForBucketKey('::')).toBe('::')
    expect(normalizeIpForBucketKey('64:ff9b::203.0.113.4')).toBe('64:ff9b::203.0.113.4')
  })

  it('rejects malformed IPv6', () => {
    expect(normalizeIpForBucketKey('2001:db8::1::2')).toBeNull()
    expect(normalizeIpForBucketKey('2001:db8:::1')).toBeNull()
    expect(normalizeIpForBucketKey('1:2:3:4:5:6:7:8:9')).toBeNull()
    expect(normalizeIpForBucketKey('2001:db8:0:0:0:0:1')).toBeNull()
    expect(normalizeIpForBucketKey('2001:zzzz::1')).toBeNull()
  })

  /**
   * REGRESSION (round 4): Azure App Service / Front Door and several CDNs put
   * `ip:port` in the XFF hop. Returning null there left the caller with NO
   * candidate, collapsing every visitor into the single egress bucket.
   */
  it('strips a bare :port from an IPv4 hop, but not from an ambiguous IPv6', () => {
    expect(normalizeIpForBucketKey('203.0.113.4:8080')).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey('203.0.113.4:0')).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey('  203.0.113.4:65535  ')).toBe('203.0.113.4')
    // Not a port (6 digits) → not stripped, and the remainder is not an address.
    expect(normalizeIpForBucketKey('203.0.113.4:123456')).toBeNull()
    // Out-of-range head is still rejected once the port comes off.
    expect(normalizeIpForBucketKey('203.0.113.256:8080')).toBeNull()
    // Unbracketed IPv6 + bare port is genuinely ambiguous (`:1` is equally a
    // final group), so the IPv6 reading wins and nothing is stripped.
    expect(normalizeIpForBucketKey('2001:db8::1')).toBe('2001:db8::1')
    expect(normalizeIpForBucketKey('::1:443')).toBe('::1:443')
  })

  it('rejects zero-padded IPv4 octets (one peer must not split two buckets)', () => {
    expect(normalizeIpForBucketKey('203.0.113.04')).toBeNull()
    expect(normalizeIpForBucketKey('203.0.113.004')).toBeNull()
    expect(normalizeIpForBucketKey('203.00.113.4')).toBeNull()
    expect(normalizeIpForBucketKey('203.0.113.04:8080')).toBeNull()
    expect(normalizeIpForBucketKey('::ffff:203.0.113.04')).toBeNull()
    // A lone `0` octet is not padding.
    expect(normalizeIpForBucketKey('203.0.113.0')).toBe('203.0.113.0')
  })

  it('rejects a dangling separator and a misplaced embedded IPv4', () => {
    expect(normalizeIpForBucketKey('2001:db8::1:')).toBeNull()
    expect(normalizeIpForBucketKey(':2001:db8::1')).toBeNull()
    expect(normalizeIpForBucketKey('1.2.3.4::1')).toBeNull()
    expect(normalizeIpForBucketKey('::1.2.3.4:5')).toBeNull()
    // The legitimate shapes still pass.
    expect(normalizeIpForBucketKey('::')).toBe('::')
    expect(normalizeIpForBucketKey('2001:db8::')).toBe('2001:db8::')
    expect(normalizeIpForBucketKey('::1.2.3.4')).toBe('::1.2.3.4')
  })

  it('rejects oversized input rather than making an unbounded key', () => {
    const oversized = 'a'.repeat(IP_BUCKET_KEY_MAX_LENGTH + 1)
    expect(oversized.length).toBeGreaterThan(IP_BUCKET_KEY_MAX_LENGTH)
    expect(normalizeIpForBucketKey(oversized)).toBeNull()
    // A valid address padded past the cap is still refused.
    expect(normalizeIpForBucketKey(`203.0.113.4${' '.repeat(200)}`)).toBe('203.0.113.4')
    expect(normalizeIpForBucketKey(`${'0'.repeat(70)}.1.1.1`)).toBeNull()
  })

  it('rejects junk', () => {
    expect(normalizeIpForBucketKey('')).toBeNull()
    expect(normalizeIpForBucketKey('   ')).toBeNull()
    expect(normalizeIpForBucketKey('unknown')).toBeNull()
    expect(normalizeIpForBucketKey('example.com')).toBeNull()
    expect(normalizeIpForBucketKey('203.0.113.4, 198.51.100.7')).toBeNull()
    expect(normalizeIpForBucketKey(undefined as unknown as string)).toBeNull()
  })
})
