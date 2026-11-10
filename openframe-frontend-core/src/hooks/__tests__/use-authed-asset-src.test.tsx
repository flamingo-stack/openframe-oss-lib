import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { forwardRef, type ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { ChatMessageRow } from '../../components/chat/chat-message-row';
import { EntityImage } from '../../components/ui/entity-image';
import { LoadingScope } from '../../components/ui/loading-scope';
import { SquareAvatar } from '../../components/ui/square-avatar';
import Image, { registerImage } from '../../embed-shims/next-image';
import { type EmbedAuthAdapter, setEmbedAuthAdapter } from '../../utils/embed-authed-fetch';
import { clearAuthedAssetCache, useAuthedAsset } from '../use-authed-asset-src';

/**
 * The asset store a picture is drawn through. jsdom's page is http://localhost:3000/; the "gateway" below is a
 * different origin, as a native shell's is (its page is `tauri://localhost`), so its pictures open only with the
 * bearer.
 */
const GATEWAY = 'https://gw.example';
// The store's RELEASE_DELAY_MS, which it does not export.
const RELEASE_DELAY_MS = 60_000;

let token: string | undefined;
const credentialListeners = new Set<() => void>();

/** The shell's credential arriving, or rotating: what `adapter.subscribe` reports. */
function credential(next: string | undefined): void {
  token = next;
  for (const listener of [...credentialListeners]) listener();
}

const shellAdapter: EmbedAuthAdapter = {
  getHeaders: () => (token ? { Authorization: `Bearer ${token}` } : {}),
  hasCredential: () => token !== undefined,
  allowedOrigins: [GATEWAY],
  resolveAssetUrl: url => (url.startsWith('/images/') ? `${GATEWAY}/api${url}` : url),
  subscribe: listener => {
    credentialListeners.add(listener);
    return () => credentialListeners.delete(listener);
  },
};

function picture(status = 200, type = 'image/png'): Response {
  return new Response(new Blob(['png'], { type }), { status, headers: { 'Content-Type': type } });
}

let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;
let blobCount = 0;

beforeEach(() => {
  token = undefined;
  blobCount = 0;
  fetchMock = vi.fn(() => Promise.resolve(picture()));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${GATEWAY}/${++blobCount}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  clearAuthedAssetCache();
  setEmbedAuthAdapter(null);
  credentialListeners.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAuthedAsset', () => {
  it('passes a URL through with no adapter (a host that authenticates by cookie or not at all)', () => {
    const { result } = renderHook(() => useAuthedAsset('/images/user/1'));
    expect(result.current).toEqual({ status: 'native', src: '/images/user/1', url: '/images/user/1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('draws a backend path from where the host says it lives, natively on cookie-auth web', () => {
    setEmbedAuthAdapter({ getHeaders: () => ({}), resolveAssetUrl: shellAdapter.resolveAssetUrl });
    const { result } = renderHook(() => useAuthedAsset('/images/user/1?v=abc'));
    expect(result.current.status).toBe('native');
    expect(result.current.src).toBe(`${GATEWAY}/api/images/user/1?v=abc`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves a third-party picture to the browser, credential or not', () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    const { result } = renderHook(() => useAuthedAsset('https://lh3.googleusercontent.com/a/x'));
    expect(result.current).toEqual({
      status: 'native',
      src: 'https://lh3.googleusercontent.com/a/x',
      url: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('waits for the credential instead of drawing a gateway picture without it, then fetches it', async () => {
    setEmbedAuthAdapter(shellAdapter);
    const { result } = renderHook(() => useAuthedAsset('/images/user/1', 'image/*'));
    // A native load now would be a 401 that nothing ever retries: draw nothing, request nothing.
    expect(result.current).toEqual({ status: 'pending', src: undefined, url: `${GATEWAY}/api/images/user/1` });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => credential('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.src).toMatch(/^blob:/);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(result.current.src);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GATEWAY}/api/images/user/1`);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t1', Accept: 'image/*' });
  });

  it('follows an adapter registered after the first render', async () => {
    token = 't1';
    const { result } = renderHook(() => useAuthedAsset(`${GATEWAY}/api/images/user/2`));
    expect(result.current.status).toBe('native');
    act(() => setEmbedAuthAdapter(shellAdapter));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('fetches a picture drawn before any adapter once the adapter, registered without a credential, announces one', async () => {
    const { result } = renderHook(() => useAuthedAsset('/images/user/20'));
    expect(result.current.status).toBe('native');
    act(() => setEmbedAuthAdapter(shellAdapter));
    await waitFor(() => expect(result.current.status).toBe('pending'));

    act(() => credential('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('keeps listening for the credential for the pictures still mounted when another one unmounts', async () => {
    setEmbedAuthAdapter(shellAdapter);
    const leaving = renderHook(() => useAuthedAsset('/images/user/21'));
    const staying = renderHook(() => useAuthedAsset('/images/user/22'));
    expect(staying.result.current.status).toBe('pending');
    leaving.unmount();

    act(() => credential('t1'));
    await waitFor(() => expect(staying.result.current.status).toBe('ready'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${GATEWAY}/api/images/user/22`);
  });

  it("holds one subscription to the adapter's credential for all its consumers, and lets go of it with the last", async () => {
    function countingSubscriptions(): { adapter: EmbedAuthAdapter; live: Set<symbol> } {
      const live = new Set<symbol>();
      const subscribe = () => {
        const subscription = Symbol('subscription');
        live.add(subscription);
        return () => live.delete(subscription);
      };
      return { adapter: { ...shellAdapter, subscribe }, live };
    }
    const first = countingSubscriptions();
    setEmbedAuthAdapter(first.adapter);
    const consumers = ['/images/user/23', '/images/user/24', '/images/user/24'].map(src =>
      renderHook(() => useAuthedAsset(src)),
    );
    expect(first.live.size).toBe(1);

    // The host's provider remounting with a new adapter: the subscription moves to it.
    const second = countingSubscriptions();
    act(() => {
      setEmbedAuthAdapter(null);
      setEmbedAuthAdapter(second.adapter);
    });
    await act(() => Promise.resolve());
    expect(first.live.size).toBe(0);
    expect(second.live.size).toBe(1);

    for (const consumer of consumers) consumer.unmount();
    expect(second.live.size).toBe(0);
    // With nobody left to tell, a later registration is not followed either.
    setEmbedAuthAdapter(null);
    setEmbedAuthAdapter(second.adapter);
    expect(second.live.size).toBe(0);
  });

  it('reports a failure, and retries it when the credential changes', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('expired');
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 401 })));
    const { result } = renderHook(() => useAuthedAsset('/images/user/3'));
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.src).toBeUndefined();
    expect(result.current.url).toBe(`${GATEWAY}/api/images/user/3`);

    act(() => credential('fresh'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('retries a request that got no answer when the credential changes', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
    const { result } = renderHook(() => useAuthedAsset('/images/user/25'));
    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => credential('t2'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a refusal other than a 401 when the credential changes', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 403 })));
    const { result } = renderHook(() => useAuthedAsset('/images/user/26'));
    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => credential('t2'));
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 401 when the browser comes back online, as only a new credential can lift it', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 401 })));
    const { result } = renderHook(() => useAuthedAsset('/images/user/27'));
    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a page answered for a picture as a failure (a shell's asset server falls back to its SPA)", async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
    const { result } = renderHook(() => useAuthedAsset('/images/user/4'));
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('fetches one picture once for every consumer of it', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    const a = renderHook(() => useAuthedAsset('/images/user/5'));
    const b = renderHook(() => useAuthedAsset('/images/user/5'));
    await waitFor(() => expect(a.result.current.status).toBe('ready'));
    await waitFor(() => expect(b.result.current.src).toBe(a.result.current.src));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches again for a mounted consumer after the cache is cleared at session end', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('first-session');
    const { result } = renderHook(() => useAuthedAsset('/images/user/6'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const firstBlob = result.current.src;

    // The host clears, then forgets its token in the same task (apps/web's clearTokens): nothing may go out with it.
    act(() => {
      clearAuthedAssetCache();
      token = undefined;
    });
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstBlob);
    await act(() => Promise.resolve());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => credential('second-session'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.src).not.toBe(firstBlob);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers).toMatchObject({
      Authorization: 'Bearer second-session',
    });
  });

  it('drops a picture fetched under the previous session when the cache is cleared while it is in flight', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('first');
    let answerFirst: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => (answerFirst = resolve)));
    const { result } = renderHook(() => useAuthedAsset('/images/user/28'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      clearAuthedAssetCache();
      token = undefined;
    });
    act(() => answerFirst(picture()));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    const fenced = vi.mocked(URL.createObjectURL).mock.results[0]?.value as string;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fenced);
    expect(result.current.status).toBe('pending');

    act(() => credential('second'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.src).not.toBe(fenced);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers).toMatchObject({
      Authorization: 'Bearer second',
    });
  });

  it('revokes a picture a minute after its last consumer let go, and fetches it again for the next one', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    const first = renderHook(() => useAuthedAsset('/images/user/29'));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const blob = first.result.current.src;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    first.unmount();
    vi.advanceTimersByTime(RELEASE_DELAY_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blob);
    vi.useRealTimers();

    const next = renderHook(() => useAuthedAsset('/images/user/29'));
    await waitFor(() => expect(next.result.current.status).toBe('ready'));
    expect(next.result.current.src).not.toBe(blob);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the picture for a consumer back within that minute, counting the minute from the last release', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    const first = renderHook(() => useAuthedAsset('/images/user/30'));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const blob = first.result.current.src;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    first.unmount();
    vi.advanceTimersByTime(RELEASE_DELAY_MS / 2);
    const back = renderHook(() => useAuthedAsset('/images/user/30'));
    expect(back.result.current.src).toBe(blob);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    back.unmount();
    // Past the minute of the first release, inside the second's.
    vi.advanceTimersByTime(RELEASE_DELAY_MS / 2 + 1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RELEASE_DELAY_MS / 2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blob);
  });

  it('stays failed while a retry runs, so a fallback does not flicker back to a placeholder', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('expired');
    let answerRetry: (response: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(new Response('', { status: 401 })))
      .mockImplementationOnce(() => new Promise<Response>(resolve => (answerRetry = resolve)));
    const { result } = renderHook(() => useAuthedAsset('/images/user/9'));
    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => credential('fresh'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('failed');

    act(() => answerRetry(picture()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it("does not retry a refusal the session's own refresh could not lift, so pictures cannot keep rotating it", async () => {
    // The gateway refuses these pictures to every credential. Each 401 refreshes (rotates) once inside
    // embedAuthedFetch; the rotation must not send every other failed picture out again to rotate once more.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let refreshes = 0;
    setEmbedAuthAdapter({
      ...shellAdapter,
      refresh: async () => {
        refreshes++;
        await new Promise(resolve => setTimeout(resolve, 5));
        credential(`t${refreshes + 1}`);
        return true;
      },
    });
    credential('t1');
    // Out of phase: each picture answers at its own pace, so their refreshes do not fold into one.
    const latency: Record<string, number> = { '10': 2, '11': 17, '12': 41 };
    fetchMock.mockImplementation(
      (url: string) =>
        new Promise<Response>(resolve =>
          setTimeout(() => resolve(new Response('', { status: 401 })), latency[url.split('/').pop() ?? ''] ?? 0),
        ),
    );
    const pictures = ['/images/user/10', '/images/user/11', '/images/user/12'].map(src =>
      renderHook(() => useAuthedAsset(src)),
    );
    for (const { result } of pictures) await waitFor(() => expect(result.current.status).toBe('failed'));
    await act(() => vi.advanceTimersByTimeAsync(100));
    const settled = refreshes;

    // Some other surface rotates the session.
    act(() => credential('rotated-elsewhere'));
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(refreshes).toBe(settled);
    expect(refreshes).toBeLessThanOrEqual(pictures.length);
  });

  it('does not retry a refusal however late the host announces the credential its refresh produced', async () => {
    // A host whose `subscribe` fires after `refresh()` resolved: the retry is already refused by then, and the late
    // announcement must not send it out again (it would refresh, rotate and announce late again, forever).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let refreshes = 0;
    setEmbedAuthAdapter({
      ...shellAdapter,
      refresh: () => {
        refreshes++;
        const next = `t${refreshes + 1}`;
        setTimeout(() => credential(next), 30);
        token = next;
        return Promise.resolve(true);
      },
    });
    credential('t1');
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 401 })));
    const { result } = renderHook(() => useAuthedAsset('/images/user/14'));
    await waitFor(() => expect(result.current.status).toBe('failed'));
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(refreshes).toBe(1);
  });

  it('does not retry a refusal the refresh could not lift each time another consumer joins the picture', async () => {
    let refreshes = 0;
    setEmbedAuthAdapter({
      ...shellAdapter,
      refresh: () => {
        refreshes++;
        credential(`t${refreshes + 1}`);
        return Promise.resolve(true);
      },
    });
    credential('t1');
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 401 })));
    const first = renderHook(() => useAuthedAsset('/images/user/31'));
    await waitFor(() => expect(first.result.current.status).toBe('failed'));
    const fetches = fetchMock.mock.calls.length;

    for (let i = 0; i < 3; i++) {
      renderHook(() => useAuthedAsset('/images/user/31'));
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    }
    expect(fetchMock).toHaveBeenCalledTimes(fetches);
    expect(refreshes).toBe(1);
  });

  it('fetches a waiting picture on its next render when a credential appeared unannounced', async () => {
    setEmbedAuthAdapter(shellAdapter);
    const { result, rerender } = renderHook(() => useAuthedAsset('/images/user/15'));
    expect(result.current.status).toBe('pending');
    // Another tab's sign-in: the token is readable here, and nothing announced it.
    token = 't1';
    rerender();
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('classifies through hasCredential when the host has one, and never through getHeaders', () => {
    const getHeaders = vi.fn(() => ({ Authorization: 'Bearer t1' }));
    setEmbedAuthAdapter({ ...shellAdapter, getHeaders, hasCredential: () => false });
    const { result } = renderHook(() => useAuthedAsset('/images/user/13'));
    expect(result.current.status).toBe('pending');
    expect(getHeaders).not.toHaveBeenCalled();
  });

  it('never waits for a host that does not declare header auth', () => {
    setEmbedAuthAdapter({ getHeaders: () => ({}), allowedOrigins: [GATEWAY] });
    const { result } = renderHook(() => useAuthedAsset(`${GATEWAY}/kb/1.png`));
    expect(result.current.status).toBe('native');
  });
});

describe('the boxed Image draws through the store', () => {
  afterEach(() => {
    registerImage(null as never);
  });

  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = 'none';
  };

  it("draws its box while the credential is missing, then the fetched picture, keeping the picture's address", async () => {
    setEmbedAuthAdapter(shellAdapter);
    render(<Image src="/images/user/7" alt="Ann" width={32} height={32} />);
    expect(screen.queryByRole('img')).toBeNull();

    act(() => credential('t1'));
    const img = await screen.findByRole('img', { name: 'Ann' });
    expect(img.getAttribute('src')).toMatch(/^blob:/);
    expect(img.dataset.assetSrc).toBe(`${GATEWAY}/api/images/user/7`);
  });

  it('draws the address itself once the fetch failed, so the caller sees the error a plain <img> would raise', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 403 })));
    render(<Image src="/images/user/8" alt="Bo" width={32} height={32} />);
    const img = await screen.findByRole('img', { name: 'Bo' });
    expect(img.getAttribute('src')).toBe(`${GATEWAY}/api/images/user/8`);
  });

  it('draws a retried picture into a new element, so what a caller did to the failed one does not hide it', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('expired');
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 401 })));
    render(<Image src="/images/user/16" alt="Di" width={32} height={32} onError={hide} />);
    const failed = await screen.findByRole('img', { name: 'Di' });
    fireEvent.error(failed);
    expect(failed).not.toBeVisible();

    act(() => credential('fresh'));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Di' }).getAttribute('src')).toMatch(/^blob:/));
    expect(screen.getByRole('img', { name: 'Di' })).toBeVisible();
  });

  it('draws a retried picture into a new element of a registered host image too', async () => {
    const HostImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }>(
      function HostImageImpl({ alt, unoptimized: _unoptimized, ...props }, ref) {
        return <img ref={ref} alt={alt} data-host-image="" {...props} />;
      },
    );
    registerImage(HostImage);
    setEmbedAuthAdapter(shellAdapter);
    credential('expired');
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 401 })));
    render(<Image src="/images/host/1" alt="Ed" width={32} height={32} onError={hide} />);
    const failed = await screen.findByRole('img', { name: 'Ed' });
    expect(failed).toHaveAttribute('data-host-image');
    fireEvent.error(failed);
    expect(failed).not.toBeVisible();

    act(() => credential('fresh'));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Ed' }).getAttribute('src')).toMatch(/^blob:/));
    const drawn = screen.getByRole('img', { name: 'Ed' });
    expect(drawn).toHaveAttribute('data-host-image');
    expect(drawn).toBeVisible();
  });
});

describe('SquareAvatar', () => {
  it('shows the picture again when a new src loads after one failed', () => {
    const { rerender } = render(<SquareAvatar src="https://cdn.example/broken.png" alt="Cy Doe" />);
    fireEvent.error(screen.getByRole('img', { name: 'Cy Doe' }));
    expect(screen.queryByRole('img', { name: 'Cy Doe' })).toBeNull();
    expect(screen.getByText('CD')).toBeVisible();

    rerender(<SquareAvatar src="https://cdn.example/fixed.png" alt="Cy Doe" />);
    expect(screen.getByRole('img', { name: 'Cy Doe' }).getAttribute('src')).toBe('https://cdn.example/fixed.png');
    expect(screen.getByText('CD')).toHaveClass('hidden');
  });

  it('shows initials while an authed picture fetch failed, and the picture once a new credential fetches it', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('expired');
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 401 })));
    render(<SquareAvatar src="/images/avatar/1" alt="Fay Lu" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    // Handed the raw URL instead, the avatar would draw it natively here, fail it, and let go of the entry.
    expect(screen.queryByRole('img', { name: 'Fay Lu' })).toBeNull();
    expect(screen.getByText('FL')).not.toHaveClass('hidden');

    act(() => credential('fresh'));
    const img = await screen.findByRole('img', { name: 'Fay Lu' });
    expect(img.getAttribute('src')).toMatch(/^blob:/);
  });

  it('fetches no picture in a loading scope, even with a credential to send', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    render(
      <LoadingScope>
        <SquareAvatar src="/images/avatar/2" alt="Gus Ho" />
      </LoadingScope>,
    );
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ChatMessageRow', () => {
  it('shows initials while an authed avatar fetch failed, and the avatar once the browser is back online', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<ChatMessageRow displayName="Eve Ng" avatarUrl={`${GATEWAY}/api/images/user/17`} body="Hi" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    // Keyed on the raw URL instead, the row would draw that URL natively here, fail it, and let go of the entry.
    expect(screen.queryByRole('img', { name: 'Eve Ng' })).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    const img = await screen.findByRole('img', { name: 'Eve Ng' });
    expect(img.getAttribute('src')).toMatch(/^blob:/);
  });
});

describe('EntityImage', () => {
  it('shows the initials tile while an authed logo fetch failed, and the logo once a new credential fetches it', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('expired');
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 401 })));
    render(<EntityImage src="/images/logo/1" alt="Acme Corp" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    // Handed the raw URL instead, the image would draw it natively here, fail it, and let go of the entry.
    expect(screen.queryByRole('img', { name: 'Acme Corp' })).toBeNull();
    expect(screen.getByLabelText('Acme Corp')).toHaveTextContent('AC');

    act(() => credential('fresh'));
    const img = await screen.findByRole('img', { name: 'Acme Corp' });
    expect(img.getAttribute('src')).toMatch(/^blob:/);
  });

  it('shows the initials tile instead of a broken image when a plain logo fails to load', () => {
    render(<EntityImage src="https://cdn.example/logo.png" alt="Bolt Labs" />);
    fireEvent.error(screen.getByRole('img', { name: 'Bolt Labs' }));
    expect(screen.queryByRole('img', { name: 'Bolt Labs' })).toBeNull();
    expect(screen.getByLabelText('Bolt Labs')).toHaveTextContent('BL');
  });

  it('fetches no logo in a loading scope, even with a credential to send', async () => {
    setEmbedAuthAdapter(shellAdapter);
    credential('t1');
    render(
      <LoadingScope>
        <EntityImage src="/images/logo/2" alt="Cora Inc" />
      </LoadingScope>,
    );
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
