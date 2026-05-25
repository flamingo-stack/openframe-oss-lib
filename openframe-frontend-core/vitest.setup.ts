import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'
import { registerNavigation } from './src/embed-shims/next-navigation'

// --- Shared mock state ---------------------------------------------------
//
// `useApiParams` (and friends) read navigation hooks from the embed-shim
// at `src/embed-shims/next-navigation.tsx`, NOT from `next/navigation`
// directly. Mocking `next/navigation` via `vi.mock` is therefore a no-op
// — nothing imports from it. Instead we register a test-only impl with
// `registerNavigation()` so every shim consumer (use-api-params,
// use-query-params, unified-pagination, etc.) sees the mocked router +
// searchParams.

export const mockReplace = vi.fn()
export const mockPush = vi.fn()

// `currentSearchParams` is read on every render via the registered hook,
// so tests can swap it between assertions and the next renderHook() call
// picks up the new value. The exported `mockSearchParams` Proxy reads
// through to whatever this variable points at so direct property access
// (`mockSearchParams.get('foo')`) stays current after `setMockSearchParams`.
let currentSearchParams = new URLSearchParams()

export function setMockSearchParams(params: URLSearchParams): void {
  currentSearchParams = params
}

export const mockSearchParams = new Proxy({} as URLSearchParams, {
  get(_target, prop) {
    const value = (currentSearchParams as unknown as Record<PropertyKey, unknown>)[prop]
    return typeof value === 'function' ? value.bind(currentSearchParams) : value
  },
})

registerNavigation({
  useRouter: () => ({
    replace: mockReplace as (href: string) => void,
    push: mockPush as (href: string) => void,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/',
  useParams: <T extends Record<string, string | string[]>>() => ({} as T),
  redirect: ((url: string) => { throw new Error(`[test] redirect(${url})`) }) as never,
  permanentRedirect: ((url: string) => { throw new Error(`[test] permanentRedirect(${url})`) }) as never,
  notFound: (() => { throw new Error('[test] notFound()') }) as never,
})

// Mock `window.location` with the methods jsdom doesn't expose as fns.
// Shim consumers that don't go through the router (e.g. `permanentRedirect`
// → `window.location.replace`) still need these to exist on the location
// object or they throw `TypeError: ... is not a function`.
Object.defineProperty(window, 'location', {
  value: {
    pathname: '/',
    search: '',
    href: 'http://localhost:3000/',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
})

// Reset mock call history + URL between tests so assertions stay isolated.
beforeEach(() => {
  mockReplace.mockClear()
  mockPush.mockClear()
  currentSearchParams = new URLSearchParams()
})
