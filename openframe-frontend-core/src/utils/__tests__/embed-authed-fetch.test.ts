import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { embedAuthedFetch, setEmbedAuthAdapter } from '../embed-authed-fetch'

/**
 * Tests focus on the same-origin guard rather than the proxy-auth
 * header injection (covered indirectly via existing chat consumers).
 * jsdom defaults `window.location.href` to `http://localhost:3000/`.
 */
describe('embedAuthedFetch.assertSameOrigin guard', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response('ok')) as typeof fetch
    // The cross-origin guard has a dev-mode escape hatch (warn + allow
    // instead of throw) when `NODE_ENV !== 'production'` — see
    // `embed-authed-fetch.ts`. Pin the env to production so these tests
    // exercise the bearer-leak defense, not the dev convenience path.
    vi.stubEnv('NODE_ENV', 'production')
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllEnvs()
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

describe('embedAuthedFetch 401 self-heal (adapter.refresh)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    setEmbedAuthAdapter(null)
    vi.restoreAllMocks()
  })

  it('refreshes once then retries the request on a 401', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    globalThis.fetch = fetchSpy as typeof fetch

    const refresh = vi.fn(async () => true)
    setEmbedAuthAdapter({ getHeaders: () => ({ Authorization: 'Bearer t' }), refresh })

    const res = await embedAuthedFetch('/api/chat/x')
    expect(res.status).toBe(200)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('surfaces the 401 (no retry) when refresh resolves false', async () => {
    const fetchSpy = vi.fn(async () => new Response('nope', { status: 401 }))
    globalThis.fetch = fetchSpy as typeof fetch

    const refresh = vi.fn(async () => false)
    setEmbedAuthAdapter({ refresh })

    const res = await embedAuthedFetch('/api/chat/x')
    expect(res.status).toBe(401)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('does not retry a second time when the refreshed token is also 401', async () => {
    const fetchSpy = vi.fn(async () => new Response('nope', { status: 401 }))
    globalThis.fetch = fetchSpy as typeof fetch

    const refresh = vi.fn(async () => true)
    setEmbedAuthAdapter({ refresh })

    const res = await embedAuthedFetch('/api/chat/x')
    expect(res.status).toBe(401)
    // refresh fired once; the retry's 401 is surfaced rather than looping.
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('de-dupes concurrent 401s into a single refresh', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 401 }))
      .mockResolvedValueOnce(new Response('nope', { status: 401 }))
      .mockResolvedValue(new Response('ok', { status: 200 }))
    globalThis.fetch = fetchSpy as typeof fetch

    // A refresh that stays pending until we release it — so BOTH 401s are
    // parked on the single shared slot before it settles. (If it resolved
    // eagerly, the slot could clear between the two 401s and the test would
    // race.)
    let releaseRefresh: (v: boolean) => void = () => {}
    const refreshGate = new Promise<boolean>((resolve) => {
      releaseRefresh = resolve
    })
    const refresh = vi.fn(() => refreshGate)
    setEmbedAuthAdapter({ refresh })

    const p1 = embedAuthedFetch('/api/chat/a')
    const p2 = embedAuthedFetch('/api/chat/b')

    // Wait until both initial fetches have 401'd and reached the (still
    // pending) refresh slot, then release it so both retries fire.
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    releaseRefresh(true)

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    // Both 401s shared ONE refresh call.
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('passes a 401 through untouched when no adapter is registered', async () => {
    const fetchSpy = vi.fn(async () => new Response('nope', { status: 401 }))
    globalThis.fetch = fetchSpy as typeof fetch

    const res = await embedAuthedFetch('/api/chat/x')
    expect(res.status).toBe(401)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
