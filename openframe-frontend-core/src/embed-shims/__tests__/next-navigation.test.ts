import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression tests for the `next/navigation` shim fallback (unregistered host).
 *
 * The guarantee under test: an unregistered `useRouter().push/replace` must
 * perform a same-origin SPA navigation via the History API and NEVER hard-load
 * the document — a `?search=` write from `useApiParams` used to hard-reload via
 * `window.location.replace`. The registered path must delegate to the host
 * router untouched.
 *
 * `impl` is module-level singleton state, so each test re-imports the module
 * fresh via `vi.resetModules()` to isolate registration state. We also stub
 * `window.location` with a spy object so any hard navigation (assign/replace/
 * reload) is observable — jsdom leaves those methods unimplemented anyway.
 */

const ORIGIN = 'http://localhost:3000'

async function freshModule() {
  vi.resetModules()
  return import('../next-navigation')
}

let assignSpy: ReturnType<typeof vi.fn>
let replaceSpy: ReturnType<typeof vi.fn>
let reloadSpy: ReturnType<typeof vi.fn>
let pushStateSpy: ReturnType<typeof vi.spyOn>
let replaceStateSpy: ReturnType<typeof vi.spyOn>
let originalLocation: Location

beforeEach(() => {
  originalLocation = window.location
  assignSpy = vi.fn()
  replaceSpy = vi.fn()
  reloadSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: `${ORIGIN}/`,
      origin: ORIGIN,
      pathname: '/',
      search: '',
      assign: assignSpy,
      replace: replaceSpy,
      reload: reloadSpy,
    },
  })
  // Real jsdom history — spy without changing behavior so we can assert which
  // History API the fallback used (push vs replace encodes the nav semantics).
  pushStateSpy = vi.spyOn(window.history, 'pushState')
  replaceStateSpy = vi.spyOn(window.history, 'replaceState')
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  vi.restoreAllMocks()
})

describe('fallback useRouter (unregistered host)', () => {
  it('replace() writes the URL via history.replaceState — never a hard navigation', async () => {
    const { useRouter } = await freshModule()
    const popstate = vi.fn()
    window.addEventListener('popstate', popstate)

    useRouter().replace('?search=laptop')

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', `${ORIGIN}/?search=laptop`)
    expect(pushStateSpy).not.toHaveBeenCalled()
    // No full-document navigation of any kind — this is the reported bug.
    expect(assignSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(reloadSpy).not.toHaveBeenCalled()
    // Subscribers (usePathname/useSearchParams) get a re-render signal.
    expect(popstate).toHaveBeenCalledTimes(1)

    window.removeEventListener('popstate', popstate)
  })

  it('push() uses history.pushState (new entry) — never a hard navigation', async () => {
    const { useRouter } = await freshModule()
    useRouter().push('/scripts?tab=list')

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', `${ORIGIN}/scripts?tab=list`)
    expect(replaceStateSpy).not.toHaveBeenCalled()
    expect(assignSpy).not.toHaveBeenCalled()
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('falls back to a real navigation for cross-origin targets', async () => {
    const { useRouter } = await freshModule()
    useRouter().replace('https://example.com/evil')

    expect(assignSpy).toHaveBeenCalledWith('https://example.com/evil')
    expect(replaceStateSpy).not.toHaveBeenCalled()
    expect(pushStateSpy).not.toHaveBeenCalled()
  })

  it('falls back to a real navigation for a malformed href', async () => {
    const { useRouter } = await freshModule()
    useRouter().push('http://[invalid')

    expect(assignSpy).toHaveBeenCalledWith('http://[invalid')
    expect(pushStateSpy).not.toHaveBeenCalled()
  })

  it('back/forward remain history-based (unchanged)', async () => {
    const { useRouter } = await freshModule()
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const forwardSpy = vi.spyOn(window.history, 'forward').mockImplementation(() => {})
    useRouter().back()
    useRouter().forward()
    expect(backSpy).toHaveBeenCalledTimes(1)
    expect(forwardSpy).toHaveBeenCalledTimes(1)
  })
})

describe('registered useRouter (Next host)', () => {
  it('delegates to the host router and never touches window.location or history', async () => {
    const { useRouter, registerNavigation } = await freshModule()
    const hostRouter = {
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }
    registerNavigation({ useRouter: () => hostRouter })

    const r = useRouter()
    r.replace('?search=laptop', { scroll: false })
    r.push('/scripts')

    expect(hostRouter.replace).toHaveBeenCalledWith('?search=laptop', { scroll: false })
    expect(hostRouter.push).toHaveBeenCalledWith('/scripts')
    // The fallback path is completely bypassed — no navigation side effects.
    expect(assignSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(pushStateSpy).not.toHaveBeenCalled()
    expect(replaceStateSpy).not.toHaveBeenCalled()
  })
})
