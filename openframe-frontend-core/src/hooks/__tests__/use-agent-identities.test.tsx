import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { setEmbedAuthAdapter } from '../../utils/embed-authed-fetch';
import { AGENT_IDENTITIES_API_PATH, useAgentIdentities } from '../use-agent-identities';

const FAE = { name: null, url: 'https://files.test/fae.webp' };
const IDENTITIES = { fae: FAE };

const fetchMock = vi.fn<typeof fetch>();
const answer = () => Promise.resolve(new Response(JSON.stringify({ agents: [{ slug: 'fae', icon: FAE }] })));
const status = (code: number) => () => Promise.resolve(new Response('no', { status: code }));
const noAnswer = () => Promise.reject(new TypeError('Failed to fetch'));
/** The headers arrive and the connection drops before the body does. */
const cutShort = () =>
  Promise.resolve(Object.assign(new Response('{'), { json: () => Promise.reject(new TypeError('network error')) }));

/** The next read stays in flight until the function this returns is given its answer. */
function inFlight() {
  let land: (response: Response) => void = () => undefined;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => (land = resolve)));
  return (response: Response) => land(response);
}

const SIGNED_LATE = { Authorization: 'Bearer late' };
/** The host registering its adapter after the read was mounted. */
const registerLate = () => act(() => setEmbedAuthAdapter({ getHeaders: () => SIGNED_LATE }));

/** Lets `ms` pass: the timers due in it fire, and what they settle is rendered. */
const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
/** Longer than every wait between timed attempts put together. */
const LONG = 600_000;

/** A page: one react-query client above every caller rendered on it. */
function pageOf(client: QueryClient) {
  return function Page({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** The hook on a page (`client`); `rerender({ on })` is the host saying whether its session is in place. */
function read(on = true, client = new QueryClient()) {
  return renderHook(({ on: enabled }) => useAgentIdentities(AGENT_IDENTITIES_API_PATH, enabled), {
    initialProps: { on },
    wrapper: pageOf(client),
  });
}

/**
 * A host adapter that reports its credential changes; `rotate()` is the host holding a new one. A `refresh` is
 * handed `changed`, to report the credential it brought in.
 */
function adapterWithCredentialChanges(refresh?: (changed: () => void) => Promise<boolean>) {
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of [...listeners]) listener();
  };
  setEmbedAuthAdapter({
    refresh: refresh && (() => refresh(changed)),
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  return { rotate: () => act(changed) };
}

const shown = () => act(() => void window.dispatchEvent(new Event('visibilitychange')));
const reconnected = () =>
  act(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  setEmbedAuthAdapter(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a read another attempt can get past is asked again on a timer, a few times', () => {
  it.each([
    ['a 5xx', status(502)],
    ['a 408', status(408)],
    ['a 429', status(429)],
    ['no answer', noAnswer],
    ['an answer cut short', cutShort],
  ])('reads the identities on the second attempt after %s', async (_, failure) => {
    fetchMock.mockImplementationOnce(failure).mockImplementation(answer);
    const { result } = read();
    await pass(0);
    expect(result.current).toBeUndefined();
    // The wait, and the millisecond after it in which react-query tells its observers.
    await pass(2_001);
    expect(result.current).toEqual(IDENTITIES);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('waits longer before each of three more attempts, then stops and says so', async () => {
    fetchMock.mockImplementation(status(503));
    read();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await pass(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await pass(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await pass(5_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await pass(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await pass(17_999);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(consoleError).not.toHaveBeenCalled();
    await pass(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(consoleError).toHaveBeenCalledTimes(1);
    const [said, why] = consoleError.mock.calls[0] as [string, Error];
    expect(said).toContain(AGENT_IDENTITIES_API_PATH);
    expect(why.message).toBe('agent identities read failed (503)');
  });

  it('drops a waiting attempt when the host takes the session back, and asks once it is in place again', async () => {
    fetchMock.mockImplementationOnce(status(503)).mockImplementation(answer);
    const { result, rerender } = read();
    await pass(0);
    rerender({ on: false });
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ on: true });
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('keeps the waiting attempt of one caller when another, on the same endpoint, is held back', async () => {
    fetchMock.mockImplementationOnce(status(503)).mockImplementation(answer);
    const page = new QueryClient();
    const { result } = read(true, page);
    read(false, page);
    await pass(2_001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('drops a waiting attempt when the caller that asked leaves and the one that stays is held back', async () => {
    fetchMock.mockImplementation(status(503));
    const page = new QueryClient();
    const asking = read(true, page);
    read(false, page);
    await pass(0);
    asking.unmount();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops the attempts left for an endpoint its caller moved away from, when the one that stays is held back', async () => {
    fetchMock.mockImplementation(url => (url === '/old' ? status(503)() : answer()));
    const page = new QueryClient();
    const moving = renderHook(({ endpoint }) => useAgentIdentities(endpoint), {
      initialProps: { endpoint: '/old' },
      wrapper: pageOf(page),
    });
    renderHook(() => useAgentIdentities('/old', false), { wrapper: pageOf(page) });
    await pass(0);
    moving.rerender({ endpoint: '/new' });
    await pass(LONG);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/old')).toHaveLength(1);
    expect(moving.result.current).toEqual(IDENTITIES);
  });

  it('asks again, signed, when the host registers its adapter while the unsigned read is in flight', async () => {
    const land = inFlight();
    fetchMock.mockImplementation(answer);
    const { result } = read();
    await pass(0);
    registerLate();
    land(new Response('no', { status: 401 }));
    await pass(2_001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject(SIGNED_LATE);
    expect(result.current).toEqual(IDENTITIES);
  });
});

describe('a refused read is never asked again on a timer', () => {
  it.each([401, 403, 404])('asks once after a %i, and says so', async code => {
    fetchMock.mockImplementation(status(code));
    const { result } = read();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBeUndefined();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('sends nothing, and never asks again, when the host itself refuses to send', async () => {
    setEmbedAuthAdapter({
      beforeRequest: () => {
        throw new Error('update required');
      },
    });
    read();
    await pass(LONG);
    shown();
    reconnected();
    await pass(LONG);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe('what asks again once the timed attempts are over', () => {
  /** The first attempt and its three timed ones all fail; the one after them is answered. */
  const failThenAnswer = (failure: () => Promise<Response>) => {
    for (let attempt = 0; attempt < 4; attempt++) fetchMock.mockImplementationOnce(failure);
    fetchMock.mockImplementation(answer);
  };

  it.each([
    ['the page is shown again', shown],
    ['the browser is back online', reconnected],
  ])('asks when %s', async (_, event) => {
    failThenAnswer(status(503));
    const { result } = read();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    event();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('asks when the host holds a new credential', async () => {
    const host = adapterWithCredentialChanges();
    failThenAnswer(noAnswer);
    const { result } = read();
    await pass(LONG);
    host.rotate();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.current).toEqual(IDENTITIES);
  });
});

describe('a 401 no refresh got past is asked again for a new credential only, any other refusal when the read is turned off and on', () => {
  it.each([
    ['the page is shown again', shown],
    ['the browser is back online', reconnected],
  ])('leaves a 401 alone when %s: only a new credential can lift it', async (_, event) => {
    fetchMock.mockImplementation(status(401));
    read();
    await pass(0);
    event();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks a 401 again when the host holds a new credential', async () => {
    const host = adapterWithCredentialChanges();
    fetchMock.mockImplementationOnce(status(401)).mockImplementation(answer);
    const { result } = read();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    host.rotate();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('asks a 401 again for the credential that follows a refresh that failed', async () => {
    const host = adapterWithCredentialChanges(() => Promise.resolve(false));
    fetchMock.mockImplementationOnce(status(401)).mockImplementation(answer);
    const { result } = read();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    host.rotate();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('asks a 401 again for a credential that arrived while the read was in flight', async () => {
    const host = adapterWithCredentialChanges(() => Promise.resolve(false));
    const land = inFlight();
    fetchMock.mockImplementation(answer);
    const { result } = read();
    await pass(0);
    host.rotate();
    land(new Response('no', { status: 401 }));
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Timed: the attempt that follows carries the credential the refused one left before.
    await pass(2_001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('asks nothing more for a credential reported while the read waited for its timed attempt', async () => {
    const host = adapterWithCredentialChanges(() => Promise.resolve(false));
    fetchMock.mockImplementationOnce(status(503)).mockImplementation(status(401));
    read();
    await pass(0);
    host.rotate();
    await pass(LONG);
    // The 503, and the timed attempt, which already carried the new credential.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks a refused read once for one new credential, however many callers hear of it', async () => {
    const host = adapterWithCredentialChanges();
    fetchMock.mockImplementation(status(401));
    const page = new QueryClient();
    read(true, page);
    read(true, page);
    await pass(0);
    host.rotate();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops after its timed attempts when the host reports a credential with every refresh that fails', async () => {
    adapterWithCredentialChanges(changed => {
      changed();
      return Promise.resolve(false);
    });
    fetchMock.mockImplementation(status(401));
    read();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    shown();
    reconnected();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('asks again, signed, when the host swaps its adapter by clearing the old one first', async () => {
    setEmbedAuthAdapter({ getHeaders: () => ({ Authorization: 'Bearer old' }) });
    fetchMock.mockImplementation((_, init) =>
      new Headers(init?.headers).get('Authorization') === SIGNED_LATE.Authorization ? answer() : status(401)(),
    );
    const { result } = read();
    await pass(0);
    act(() => {
      setEmbedAuthAdapter(null);
      setEmbedAuthAdapter({ getHeaders: () => SIGNED_LATE });
    });
    // The clear asks at once, unsigned; that attempt's 401 finds an adapter and is timed.
    await pass(2_001);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('asks a 401 again when the host registers its adapter after the read left unsigned', async () => {
    fetchMock.mockImplementationOnce(status(401)).mockImplementation(answer);
    const { result } = read();
    await pass(0);
    registerLate();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject(SIGNED_LATE);
    expect(result.current).toEqual(IDENTITIES);
  });

  it('keeps a 401 to a credential just refreshed: asking on each new one would refresh again', async () => {
    const host = adapterWithCredentialChanges(() => Promise.resolve(true));
    fetchMock.mockImplementation(status(401));
    read();
    await pass(0);
    // The read, and the one retry the adapter sent with the refreshed credential.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    host.rotate();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([403, 404])('keeps a %i on a new credential, the page shown or the browser back online', async code => {
    const host = adapterWithCredentialChanges();
    fetchMock.mockImplementation(status(code));
    read();
    await pass(0);
    host.rotate();
    shown();
    reconnected();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks a 403 again once the host turns the read off and on', async () => {
    fetchMock.mockImplementationOnce(status(403)).mockImplementation(answer);
    const { result, rerender } = read();
    await pass(0);
    rerender({ on: false });
    rerender({ on: true });
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(IDENTITIES);
  });
});

describe('a new credential sends nothing while a read is in flight, answered or held back', () => {
  it('sends nothing for a new credential while a read is in flight or answered', async () => {
    const host = adapterWithCredentialChanges();
    const land = inFlight();
    const { result } = read();
    await pass(0);
    host.rotate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    land(await answer());
    await pass(0);
    expect(result.current).toEqual(IDENTITIES);
    host.rotate();
    shown();
    reconnected();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends nothing for a new credential while a read asked over identities already held is in flight', async () => {
    const host = adapterWithCredentialChanges();
    const page = new QueryClient();
    fetchMock.mockImplementationOnce(answer).mockImplementationOnce(status(401));
    read(true, page);
    await pass(0);
    // Something on the page asks for everything it holds again, and this read is refused.
    await act(() => page.invalidateQueries());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const land = inFlight();
    host.rotate();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    host.rotate();
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    land(await answer());
    await pass(0);
  });

  it('asks nothing more for the credential its own refresh brought in, when the retry is refused too', async () => {
    adapterWithCredentialChanges(changed => {
      changed();
      return Promise.resolve(true);
    });
    fetchMock.mockImplementation(status(401));
    read();
    await pass(LONG);
    // The read, and the one retry the adapter sent with the refreshed credential.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for a new credential while the host holds the read back', async () => {
    const host = adapterWithCredentialChanges();
    fetchMock.mockImplementation(status(401));
    const { rerender } = read();
    await pass(0);
    rerender({ on: false });
    host.rotate();
    await pass(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
