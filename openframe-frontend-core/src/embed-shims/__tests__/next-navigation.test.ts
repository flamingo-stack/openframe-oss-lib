import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

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

const ORIGIN = 'http://localhost:3000';

async function freshModule() {
  vi.resetModules();
  return import('../next-navigation');
}

let assignSpy: ReturnType<typeof vi.fn>;
let replaceSpy: ReturnType<typeof vi.fn>;
let reloadSpy: ReturnType<typeof vi.fn>;
let pushStateSpy: ReturnType<typeof vi.spyOn>;
// Typed to the History method so the tests can give the spy a browser-like
// implementation without the call reading as `any`.
let replaceStateSpy: MockInstance<History['replaceState']>;
let originalLocation: Location;

beforeEach(() => {
  originalLocation = window.location;
  assignSpy = vi.fn();
  replaceSpy = vi.fn();
  reloadSpy = vi.fn();
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
  });
  // Real jsdom history — spy without changing behavior so we can assert which
  // History API the fallback used (push vs replace encodes the nav semantics).
  pushStateSpy = vi.spyOn(window.history, 'pushState');
  replaceStateSpy = vi.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.restoreAllMocks();
});

describe('fallback useRouter (unregistered host)', () => {
  it('replace() writes the URL via history.replaceState — never a hard navigation', async () => {
    const { useRouter } = await freshModule();
    const popstate = vi.fn();
    window.addEventListener('popstate', popstate);

    useRouter().replace('?search=laptop');

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', `${ORIGIN}/?search=laptop`);
    expect(pushStateSpy).not.toHaveBeenCalled();
    // No full-document navigation of any kind — this is the reported bug.
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
    // Subscribers (usePathname/useSearchParams) get a re-render signal.
    expect(popstate).toHaveBeenCalledTimes(1);

    window.removeEventListener('popstate', popstate);
  });

  it('push() uses history.pushState (new entry) — never a hard navigation', async () => {
    const { useRouter } = await freshModule();
    useRouter().push('/scripts?tab=list');

    expect(pushStateSpy).toHaveBeenCalledWith(null, '', `${ORIGIN}/scripts?tab=list`);
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('falls back to a real navigation for cross-origin targets, honoring replace semantics', async () => {
    const { useRouter } = await freshModule();
    useRouter().replace('https://example.com/evil');

    // replace() must use location.replace (no back-button entry), not assign.
    expect(replaceSpy).toHaveBeenCalledWith('https://example.com/evil');
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('uses location.assign for a cross-origin push (new history entry)', async () => {
    const { useRouter } = await freshModule();
    useRouter().push('https://example.com/evil');

    expect(assignSpy).toHaveBeenCalledWith('https://example.com/evil');
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('falls back to a real navigation for a malformed href (push → assign)', async () => {
    const { useRouter } = await freshModule();
    useRouter().push('http://[invalid');

    expect(assignSpy).toHaveBeenCalledWith('http://[invalid');
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('falls back to a real navigation for a malformed href (replace → replace)', async () => {
    const { useRouter } = await freshModule();
    useRouter().replace('http://[invalid');

    expect(replaceSpy).toHaveBeenCalledWith('http://[invalid');
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('back/forward remain history-based (unchanged)', async () => {
    const { useRouter } = await freshModule();
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const forwardSpy = vi.spyOn(window.history, 'forward').mockImplementation(() => {});
    useRouter().back();
    useRouter().forward();
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(forwardSpy).toHaveBeenCalledTimes(1);
  });
});

describe('registered useRouter (Next host)', () => {
  it('delegates to the host router and never touches window.location or history', async () => {
    const { useRouter, registerNavigation } = await freshModule();
    const hostRouter = {
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    };
    registerNavigation({ useRouter: () => hostRouter });

    const r = useRouter();
    r.replace('?search=laptop', { scroll: false });
    r.push('/scripts');

    expect(hostRouter.replace).toHaveBeenCalledWith('?search=laptop', { scroll: false });
    expect(hostRouter.push).toHaveBeenCalledWith('/scripts');
    // The fallback path is completely bypassed — no navigation side effects.
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });
});

describe('replaceUrlInPlace', () => {
  /** Mirror a History write into the inert location stub the way a browser would. */
  function mirrorWritesIntoLocation(): void {
    replaceStateSpy.mockImplementation((_state: unknown, _unused: string, url?: string | URL | null) => {
      const next = new URL(String(url), window.location.href);
      Object.assign(window.location, { href: next.href, pathname: next.pathname, search: next.search });
    });
  }

  it('unregistered host: ONE history.replaceState with a null state, never a navigation', async () => {
    const { replaceUrlInPlace } = await freshModule();
    const popstate = vi.fn<(event: PopStateEvent) => void>();
    window.addEventListener('popstate', popstate);

    replaceUrlInPlace('?search=laptop');

    // `null` state on purpose: Next copies its internal tree into the entry
    // only for a state it did not write itself, so the entry stays navigable.
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '?search=laptop');
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
    // The fallback subscribers' wake-up: one popstate, carrying no state, so a
    // Next App Router (which ignores a stateless popstate) is not involved.
    expect(popstate).toHaveBeenCalledTimes(1);
    const state: unknown = popstate.mock.calls[0]?.[0].state;
    expect(state).toBeNull();

    window.removeEventListener('popstate', popstate);
  });

  it('unregistered host: the fallback useSearchParams re-renders with the written query', async () => {
    const { replaceUrlInPlace, useSearchParams } = await freshModule();
    mirrorWritesIntoLocation();
    const { result } = renderHook(() => useSearchParams().get('search'));
    expect(result.current).toBeNull();

    act(() => replaceUrlInPlace('?search=laptop'));

    expect(result.current).toBe('laptop');
  });

  it('registered host: the same ONE replaceState, no router call and no popstate', async () => {
    const { replaceUrlInPlace, registerNavigation } = await freshModule();
    const hostRouter = {
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    };
    registerNavigation({
      useRouter: () => hostRouter,
      usePathname: () => '/',
      useSearchParams: () => new URLSearchParams(),
    });
    const popstate = vi.fn();
    window.addEventListener('popstate', popstate);

    replaceUrlInPlace('?search=laptop');

    // The host (Next 14.1+) syncs its own `useSearchParams` from the patched
    // `history.replaceState`; history listeners see exactly the event stream a
    // `router.replace` ended in, and the router itself is never asked.
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '?search=laptop');
    expect(hostRouter.replace).not.toHaveBeenCalled();
    expect(hostRouter.push).not.toHaveBeenCalled();
    expect(popstate).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();

    window.removeEventListener('popstate', popstate);
  });

  it('partial registration (router only): the fallback useSearchParams is still woken', async () => {
    const { replaceUrlInPlace, registerNavigation, useSearchParams } = await freshModule();
    registerNavigation({
      useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
      }),
    });
    mirrorWritesIntoLocation();
    const { result } = renderHook(() => useSearchParams().get('search'));

    act(() => replaceUrlInPlace('?search=laptop'));

    expect(result.current).toBe('laptop');
  });

  it('is a no-op without a window (SSR)', async () => {
    const { replaceUrlInPlace } = await freshModule();
    vi.stubGlobal('window', undefined);
    try {
      expect(() => replaceUrlInPlace('?search=laptop')).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });
});
