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

/** Lets `ms` pass: the timers due in it fire, and what they settle is rendered. */
const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
/** Longer than every wait between timed attempts put together. */
const LONG = 600_000;

/** The hook on a page of its own; `rerender({ on })` is the host saying whether its session is in place. */
function read(on = true) {
  const client = new QueryClient();
  return renderHook(({ on: enabled }) => useAgentIdentities(AGENT_IDENTITIES_API_PATH, enabled), {
    initialProps: { on },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

/** A host adapter that reports its credential changes; `rotate()` is the host holding a new one. */
function adapterWithCredentialChanges(refresh?: () => Promise<boolean>) {
  const listeners = new Set<() => void>();
  setEmbedAuthAdapter({
    refresh,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  return {
    rotate: () =>
      act(() => {
        for (const listener of [...listeners]) listener();
      }),
  };
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

describe('a read another attempt can get past (no answer, a 5xx) is asked again on a timer, a few times', () => {
  it.each([
    ['a 5xx', status(502)],
    ['no answer', noAnswer],
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

  it('asks once when the host itself refuses to send', async () => {
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

  it('asks a 401 again when the host registers its adapter after the read left unsigned', async () => {
    fetchMock.mockImplementationOnce(status(401)).mockImplementation(answer);
    const { result } = read();
    await pass(0);
    act(() => setEmbedAuthAdapter({ getHeaders: () => ({ Authorization: 'Bearer late' }) }));
    await pass(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer late' });
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

  it.each([403, 404])('keeps a %i whatever happens', async code => {
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

  it('sends nothing for a new credential while a read is in flight or answered', async () => {
    const host = adapterWithCredentialChanges();
    let land: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>(resolve => (land = resolve)));
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
