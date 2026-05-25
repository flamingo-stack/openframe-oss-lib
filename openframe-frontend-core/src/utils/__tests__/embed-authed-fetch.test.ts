import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { embedAuthedFetch } from '../embed-authed-fetch'

/**
 * Tests focus on the same-origin guard rather than the proxy-auth
 * header injection (covered indirectly via existing chat consumers).
 * jsdom defaults `window.location.href` to `http://localhost:3000/`.
 */
describe('embedAuthedFetch.assertSameOrigin guard', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response('ok')) as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('allows path-only URLs', async () => {
    await expect(embedAuthedFetch('/api/chat/agent/propose')).resolves.toBeDefined()
  })

  it('allows absolute same-origin URLs', async () => {
    await expect(embedAuthedFetch('http://localhost:3000/api/foo')).resolves.toBeDefined()
  })

  it('rejects absolute cross-origin URLs', async () => {
    expect(() => embedAuthedFetch('https://evil.com/x')).toThrow(/cross-origin/i)
  })

  it('rejects protocol-relative cross-origin URLs', async () => {
    expect(() => embedAuthedFetch('//evil.com/x')).toThrow(/cross-origin/i)
  })

  it('rejects WHITESPACE-PREFIXED protocol-relative URLs (tab/newline/space)', async () => {
    // Without the unconditional URL-resolution path, the WHATWG fetch
    // spec strips leading whitespace and parses these as protocol-
    // relative — leaking the bearer to evil.com. The guard must catch
    // them BEFORE handing the string to native fetch.
    expect(() => embedAuthedFetch('\t//evil.com/x')).toThrow(/cross-origin/i)
    expect(() => embedAuthedFetch('\n//evil.com/x')).toThrow(/cross-origin/i)
    expect(() => embedAuthedFetch('\r//evil.com/x')).toThrow(/cross-origin/i)
    expect(() => embedAuthedFetch(' //evil.com/x')).toThrow(/cross-origin/i)
  })

  it('rejects javascript: URLs', async () => {
    expect(() => embedAuthedFetch('javascript:alert(1)')).toThrow(/non-http\(s\)/i)
  })

  it('rejects data: URLs', async () => {
    expect(() => embedAuthedFetch('data:text/plain,hi')).toThrow(/non-http\(s\)/i)
  })

  it('rejects blob: URLs', async () => {
    expect(() => embedAuthedFetch('blob:http://localhost:3000/abc')).toThrow(/non-http\(s\)/i)
  })

  it('does not leak the bearer to a cross-origin URL (fetch never called)', async () => {
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    expect(() => embedAuthedFetch('https://evil.com/x', {
      headers: { Authorization: 'Bearer leaked-secret' },
    })).toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
})
