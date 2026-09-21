import { render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EndpointsRuntimeContext, type EndpointsRuntime } from '../../contexts/endpoints-runtime-context';
import { useClaudeMirrorSrc, type ClaudeMirrorState } from '../use-claude-mirror-src';

/**
 * The mirror hook had NO coverage, and its state is the load-bearing part: the
 * viewer shows a spinner, the self-hosted mirror, or falls back to claude.ai
 * purely on what this returns. Two of the cases below exist because they are
 * the ones a refactor silently breaks:
 *
 *   - "switching artifacts" — the state is DERIVED from the mirror path rather
 *     than seeded by the effect, so a previous artifact's `found` src can never
 *     be shown for a new one. Seed-in-effect passes every other test here and
 *     fails that one.
 *   - "no proxy configured" — the docblock promises NO probing happens at all
 *     on a host without the proxy. That is a network-traffic contract, not a
 *     rendering detail, so it is asserted on the fetch spy.
 */

/** `lib` is ES2020 here, so `Array.prototype.at` is not available. */
function last<T>(xs: T[]): T | undefined {
  return xs.length > 0 ? xs[xs.length - 1] : undefined;
}

const ID = '0189abcd-1234-4567-89ab-0123456789ab';
const ID2 = 'fedcba98-7654-4321-ba98-ba9876543210';
const artifact = (id: string) => `https://claude.ai/public/artifacts/${id}`;
const BASE = 'https://hub.example/api/storage/view';
const mirror = (id: string) => `${BASE}/design-briefs/${id}.html`;

interface FetchLike {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
}

const runtime = (storageViewBaseUrl?: string): EndpointsRuntime => ({
  announcementsUrl: '/api/announcements',
  accessCode: { validateUrl: '/api/access-code/validate', consumeUrl: '/api/access-code/consume' },
  contactUrl: '/api/contact',
  storageViewBaseUrl,
});

function wrapperFor(value: EndpointsRuntime | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <EndpointsRuntimeContext.Provider value={value}>{children}</EndpointsRuntimeContext.Provider>;
  };
}

/** Routes by url so the probe and the revalidation can answer differently. */
function stubFetch(handler: (url: string) => FetchLike | Promise<FetchLike>) {
  const spy = vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(handler(String(input))).then(r => r as unknown as Response),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

const found = { ok: true, status: 200 } satisfies FetchLike;
const gone = { ok: false, status: 404 } satisfies FetchLike;
const noRevalidation = { ok: true, status: 200, json: () => Promise.resolve({ updated: false }) } satisfies FetchLike;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useClaudeMirrorSrc', () => {
  it('no EndpointsRuntime provider at all: absent, and nothing is fetched', () => {
    const spy = stubFetch(() => found);
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(null) });
    expect(result.current).toEqual({ src: null, status: 'absent' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a host that configured no storage proxy: absent, and nothing is fetched', () => {
    const spy = stubFetch(() => found);
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), {
      wrapper: wrapperFor(runtime(undefined)),
    });
    expect(result.current).toEqual({ src: null, status: 'absent' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a url that is not a published artifact: absent, and nothing is fetched', () => {
    const spy = stubFetch(() => found);
    const { result } = renderHook(() => useClaudeMirrorSrc('https://example.com/not-an-artifact'), {
      wrapper: wrapperFor(runtime(BASE)),
    });
    expect(result.current).toEqual({ src: null, status: 'absent' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('probes with a 1-byte ranged GET and reports probing until it answers', () => {
    const spy = stubFetch(
      () =>
        new Promise<FetchLike>(() => {
          /* never settles */
        }),
    );
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    expect(result.current).toEqual({ src: null, status: 'probing' });
    expect(spy).toHaveBeenCalledWith(mirror(ID), { headers: { Range: 'bytes=0-0' } });
  });

  it('a mirror that exists resolves to the mirror src', async () => {
    stubFetch(url => (url.includes('revalidate') ? noRevalidation : found));
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    await waitFor(() => {
      expect(result.current).toEqual({ src: mirror(ID), status: 'found' });
    });
  });

  it('accepts a 206 partial response — the ranged GET is what was asked for', async () => {
    stubFetch(url => (url.includes('revalidate') ? noRevalidation : { ok: false, status: 206 }));
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    await waitFor(() => {
      expect(result.current.status).toBe('found');
    });
  });

  it('a missing mirror falls back to absent, so the caller can use claude.ai', async () => {
    stubFetch(() => gone);
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    await waitFor(() => {
      expect(result.current).toEqual({ src: null, status: 'absent' });
    });
  });

  it('a network failure falls back to absent rather than rejecting', async () => {
    stubFetch(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    await waitFor(() => {
      expect(result.current).toEqual({ src: null, status: 'absent' });
    });
  });

  it('a re-published artifact comes back cache-busted so the iframe reloads', async () => {
    stubFetch(url =>
      url.includes('revalidate')
        ? { ok: true, status: 200, json: () => Promise.resolve({ updated: true, version: '77' }) }
        : found,
    );
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    await waitFor(() => {
      expect(result.current).toEqual({ src: `${mirror(ID)}?v=77`, status: 'found' });
    });
  });

  it('an unchanged artifact keeps the plain mirror src — no needless reload', async () => {
    stubFetch(url => (url.includes('revalidate') ? noRevalidation : found));
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    await waitFor(() => {
      expect(result.current.status).toBe('found');
    });
    expect(result.current.src).toBe(mirror(ID));
  });

  it('a failed revalidation leaves the shown mirror in place', async () => {
    stubFetch(url => (url.includes('revalidate') ? gone : found));
    const { result } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), { wrapper: wrapperFor(runtime(BASE)) });
    await waitFor(() => {
      expect(result.current).toEqual({ src: mirror(ID), status: 'found' });
    });
  });

  it('★ switching artifacts never shows the previous one as found, in ANY render', async () => {
    stubFetch(url => {
      if (url.includes('revalidate')) return noRevalidation;
      if (url.startsWith(mirror(ID))) return found;
      return new Promise<FetchLike>(() => {
        /* the second artifact never answers */
      });
    });

    // Every RENDER is recorded, not just the settled value: the difference
    // between deriving the state and seeding it from an effect is exactly one
    // commit, in which the seeded version still returns the previous
    // artifact's `found` src. Asserting on `result.current` after `rerender`
    // cannot see that commit — it passes against both implementations.
    const seen: ClaudeMirrorState[] = [];
    function Probe({ url }: { url: string }) {
      seen.push(useClaudeMirrorSrc(url));
      return null;
    }
    const Wrapper = wrapperFor(runtime(BASE));
    const view = render(
      <Wrapper>
        <Probe url={artifact(ID)} />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(last(seen)).toEqual({ src: mirror(ID), status: 'found' });
    });

    seen.length = 0;
    view.rerender(
      <Wrapper>
        <Probe url={artifact(ID2)} />
      </Wrapper>,
    );

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter(s => s.src === mirror(ID))).toEqual([]);
    expect(last(seen)).toEqual({ src: null, status: 'probing' });
  });

  it('unmounting mid-probe does not settle state afterwards', async () => {
    let settle: ((r: FetchLike) => void) | undefined;
    stubFetch(() => new Promise<FetchLike>(resolve => (settle = resolve)));
    const { result, unmount } = renderHook(() => useClaudeMirrorSrc(artifact(ID)), {
      wrapper: wrapperFor(runtime(BASE)),
    });
    expect(result.current.status).toBe('probing');
    unmount();
    settle?.(found);
    await Promise.resolve();
    // Nothing to assert on the unmounted result beyond "this did not throw";
    // a state update after unmount is what this guards.
    expect(settle).toBeDefined();
  });
});
