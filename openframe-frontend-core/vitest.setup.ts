import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import { registerNavigation, type NavigationImpl } from './src/embed-shims/next-navigation';

/**
 * The router surface the shim hands to consumers. Derived from the shim's own
 * registration contract rather than restated here, so the mocks below are
 * type-checked against the real `replace(href, { scroll })` signature that
 * `useApiParams` / `useQueryParams` actually call — and so `mock.calls[n][0]`
 * reads back as `string`, not `any`, in the tests that assert on the URL.
 */
type MockRouter = ReturnType<NavigationImpl['useRouter']>;

// --- matchMedia -----------------------------------------------------------
//
// jsdom does not implement it, and reading it THROWS rather than returning
// undefined — so a component that merely asks about a breakpoint takes its
// whole test file down. Nothing depended on the absence (every existing test
// passed without it), so a global inert stub is a no-op for them and stops the
// next responsive component from needing a per-file copy of this.
//
// `matches: false` = the narrow/default branch. A test that needs the other
// branch should override `window.matchMedia` for its own case rather than
// change this default.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// --- Web Storage on Node >= 22 -------------------------------------------
//
// Node ships its OWN `localStorage` global (experimental Web Storage). It is
// INERT unless the process was started with `--localstorage-file`, so reading
// it yields `undefined`. In vitest's jsdom environment `window === globalThis`,
// and the environment does not overwrite globals Node has already defined — so
// Node's inert `localStorage` squats on the key and jsdom's real Storage is
// never installed. `sessionStorage` has no Node counterpart, which is why it
// works and only `localStorage` breaks: the asymmetry is the fingerprint.
//
// Symptom: `TypeError: Cannot read properties of undefined (reading 'clear')`
// at `window.localStorage.clear()`, in the suites that persist chat state
// (SSE wire decode + PersistedChatState v1 rehydration).
//
// This installs a spec-shaped in-memory Storage ONLY when the global is
// missing or unusable, so on a Node without the collision jsdom's own
// implementation is left completely untouched. Keep it version-agnostic
// rather than requiring every developer to pass a Node flag.
function installLocalStorageIfMissing(): void {
  let usable = false;
  try {
    usable = typeof globalThis.localStorage?.getItem === 'function';
  } catch {
    // Node's getter can throw rather than return undefined depending on the
    // release/flags — treat any access failure as "must polyfill".
    usable = false;
  }
  if (usable) return;

  // Faithful to the Web Storage spec on the surface the code under test uses:
  // keys and values are coerced to strings, `getItem` returns `null` (not
  // `undefined`) for a miss, and `length`/`key()` reflect insertion order.
  class MemoryStorage implements Storage {
    #map = new Map<string, string>();

    get length(): number {
      return this.#map.size;
    }

    clear(): void {
      this.#map.clear();
    }

    getItem(key: string): string | null {
      const value = this.#map.get(String(key));
      return value === undefined ? null : value;
    }

    key(index: number): string | null {
      return Array.from(this.#map.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.#map.delete(String(key));
    }

    setItem(key: string, value: string): void {
      this.#map.set(String(key), String(value));
    }

    [name: string]: unknown;
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

installLocalStorageIfMissing();

// --- Shared mock state ---------------------------------------------------
//
// `useApiParams` (and friends) read navigation hooks from the embed-shim
// at `src/embed-shims/next-navigation.tsx`, NOT from `next/navigation`
// directly. Mocking `next/navigation` via `vi.mock` is therefore a no-op
// — nothing imports from it. Instead we register a test-only impl with
// `registerNavigation()` so every shim consumer (use-api-params,
// use-query-params, unified-pagination, etc.) sees the mocked router +
// searchParams.

export const mockReplace = vi.fn<MockRouter['replace']>();
export const mockPush = vi.fn<MockRouter['push']>();

// `currentSearchParams` is read on every render via the registered hook,
// so tests can swap it between assertions and the next renderHook() call
// picks up the new value. The exported `mockSearchParams` Proxy reads
// through to whatever this variable points at so direct property access
// (`mockSearchParams.get('foo')`) stays current after `setMockSearchParams`.
let currentSearchParams = new URLSearchParams();

export function setMockSearchParams(params: URLSearchParams): void {
  currentSearchParams = params;
}

export const mockSearchParams = new Proxy({} as URLSearchParams, {
  get(_target, prop) {
    const value = (currentSearchParams as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === 'function' ? value.bind(currentSearchParams) : value;
  },
});

registerNavigation({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/',
  useParams: <T extends Record<string, string | string[]>>() => ({}) as T,
  redirect: ((url: string) => {
    throw new Error(`[test] redirect(${url})`);
  }) as never,
  permanentRedirect: ((url: string) => {
    throw new Error(`[test] permanentRedirect(${url})`);
  }) as never,
  notFound: (() => {
    throw new Error('[test] notFound()');
  }) as never,
});

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
});

// Reset mock call history + URL between tests so assertions stay isolated.
beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  currentSearchParams = new URLSearchParams();
});
