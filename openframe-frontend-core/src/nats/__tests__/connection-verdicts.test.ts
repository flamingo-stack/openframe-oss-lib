/**
 * The reconnect VERDICTS of the shared connection (terminal, pause, auto-pause),
 * the failure counter that lives on the connection, and the first-dial backoff.
 * Driven against a scripted client on fake timers: these are about WHEN the
 * connection dials, which the end-to-end suite next to this one cannot pin
 * without waiting out real backoffs.
 */
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { NatsClient, NatsStatusEvent } from '../nats';
import type { ConnectionLifecycleOptions } from '../shared-connection';

interface FakeClient {
  connect: Mock<() => Promise<void>>;
  close: Mock<() => Promise<void>>;
  isConnected: () => boolean;
  onStatus: (cb: (e: NatsStatusEvent) => void) => () => void;
}

let fake: FakeClient;
let connected = false;
let dialsSucceed = false;

vi.mock('../nats', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createNatsClient: () => fake as unknown as NatsClient,
}));

const { acquireClient, releaseClient, startConnectionLifecycle, NATS_DEFAULTS } = await import('../shared-connection');

const MIN = 60_000;
let n = 0;
let url = '';

function newFake(): FakeClient {
  return {
    connect: vi.fn(() => {
      if (!dialsSucceed) return Promise.reject(new Error('refused'));
      connected = true;
      return Promise.resolve();
    }),
    close: vi.fn(async () => {}),
    isConnected: () => connected,
    onStatus: () => () => {},
  };
}

function attach(overrides: Partial<ConnectionLifecycleOptions> = {}, conn = acquireClient(url)) {
  return startConnectionLifecycle({
    conn,
    wsUrl: url,
    getFreshUrl: () => url,
    backoff: { fastRetries: 3, fastRetryDelayMs: 200 },
    ...overrides,
  });
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('shared connection verdicts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Jitter pinned: backoff delays are 0.75x, a pause is 1.1x.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    url = `ws://verdicts${++n}.test/ws/nats-api`;
    connected = false;
    dialsSucceed = false;
    fake = newFake();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('terminal', () => {
    it('stops dialling for every lifecycle and reports it, including to a late attacher', async () => {
      const onTerminal = vi.fn();
      const before = vi.fn(() => Promise.resolve('terminal' as const));
      const conn = acquireClient(url);
      attach({ onBeforeReconnect: before, onTerminal }, conn);
      await advance(1_000);
      expect(onTerminal).toHaveBeenCalledTimes(1);
      expect(conn.terminal).toBe(true);
      const dials = fake.connect.mock.calls.length;

      const lateTerminal = vi.fn();
      attach({ onTerminal: lateTerminal }, acquireClient(url));
      await advance(24 * 60 * MIN);

      expect(lateTerminal).toHaveBeenCalledTimes(1);
      expect(fake.connect).toHaveBeenCalledTimes(dials);
      expect(before).toHaveBeenCalledTimes(1);
    });

    it('is lifted by a fresh acquire, not by a consumer joining a live connection', async () => {
      const conn = acquireClient(url);
      const handle = attach({ onBeforeReconnect: () => 'terminal' }, conn);
      await advance(1_000);
      expect(conn.terminal).toBe(true);

      acquireClient(url);
      expect(conn.terminal).toBe(true);

      handle.stop();
      releaseClient(url);
      releaseClient(url);
      acquireClient(url); // back inside the close grace period, refCount 0 → fresh
      expect(conn.terminal).toBe(false);
      expect(conn.failedDials).toBe(0);
    });
  });

  describe('pause', () => {
    it('suspends dialling for at least five minutes', async () => {
      const before = vi.fn().mockResolvedValueOnce('pause').mockResolvedValue(undefined);
      attach({ onBeforeReconnect: before });
      await advance(1_000); // initial dial fails; first retry asks the callback
      await advance(1_000);
      expect(before).toHaveBeenCalledTimes(1);
      const dials = fake.connect.mock.calls.length;

      await advance(5 * MIN - 5_000);
      expect(fake.connect).toHaveBeenCalledTimes(dials);

      await advance(MIN);
      expect(fake.connect.mock.calls.length).toBeGreaterThan(dials);
    });

    it('ends early when the tab becomes visible, but not within the first 30s', async () => {
      attach({ onBeforeReconnect: vi.fn().mockResolvedValueOnce('pause').mockResolvedValue(undefined) });
      await advance(2_000);
      const dials = fake.connect.mock.calls.length;

      document.dispatchEvent(new Event('visibilitychange'));
      await advance(5_000);
      expect(fake.connect).toHaveBeenCalledTimes(dials); // too soon after the pause began

      await advance(NATS_DEFAULTS.PAUSE_MIN_RESUME_MS);
      document.dispatchEvent(new Event('visibilitychange'));
      await advance(5_000);
      expect(fake.connect.mock.calls.length).toBeGreaterThan(dials);
    });

    it('ends early when the browser comes back online', async () => {
      attach({ onBeforeReconnect: vi.fn().mockResolvedValueOnce('pause').mockResolvedValue(undefined) });
      await advance(2_000);
      const dials = fake.connect.mock.calls.length;
      await advance(NATS_DEFAULTS.PAUSE_MIN_RESUME_MS);

      window.dispatchEvent(new Event('online'));
      await advance(5_000);
      expect(fake.connect.mock.calls.length).toBeGreaterThan(dials);
    });
  });

  describe('auto-pause', () => {
    it('pauses after five failed dials while the callback keeps saying continue', async () => {
      const before = vi.fn(() => Promise.resolve('continue' as const));
      attach({ onBeforeReconnect: before });
      await advance(2 * MIN);
      const dials = fake.connect.mock.calls.length;
      // The initial dial plus four retries failed, the fifth retry was refused.
      expect(dials).toBe(NATS_DEFAULTS.PAUSE_AFTER_FAILURES);

      await advance(3 * MIN); // 5 min in: the pause (5.5 min here) is still running
      expect(fake.connect).toHaveBeenCalledTimes(dials);
      await advance(2 * MIN);
      expect(fake.connect.mock.calls.length).toBeGreaterThan(dials);
    });

    it('dials a single probe after the pause and pauses again if it fails', async () => {
      attach({ onBeforeReconnect: vi.fn(() => Promise.resolve('continue' as const)) });
      await advance(2 * MIN);
      const dials = fake.connect.mock.calls.length;

      await advance(4 * MIN); // pause over, probe failed
      expect(fake.connect).toHaveBeenCalledTimes(dials + 1);
      await advance(3 * MIN); // the failed probe met the threshold again
      expect(fake.connect).toHaveBeenCalledTimes(dials + 1);
    });

    it('consults the callback with the failure count before pausing', async () => {
      const seen: number[] = [];
      attach({
        onBeforeReconnect: ({ consecutiveFailures }) => {
          seen.push(consecutiveFailures);
        },
      });
      await advance(2 * MIN);
      expect(seen.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('failure counter on the connection', () => {
    it('is inherited by a successor instead of restarting at the fast tier', async () => {
      const conn = acquireClient(url);
      const a = attach({}, conn);
      attach({}, acquireClient(url));
      await advance(10_000);
      expect(conn.failedDials).toBeGreaterThanOrEqual(3);
      const failures = conn.failedDials;
      expect(conn.failedDials).toBeLessThan(NATS_DEFAULTS.PAUSE_AFTER_FAILURES);

      a.stop(); // owner leaves; the second lifecycle takes the loop
      const dials = fake.connect.mock.calls.length;
      await advance(300); // a fresh counter would dial within the 200ms fast tier
      expect(fake.connect).toHaveBeenCalledTimes(dials);
      expect(conn.failedDials).toBe(failures);
    });

    it('counts a dial once when several lifecycles joined it', async () => {
      // Like `NatsClient.connect`: concurrent callers share the dial in flight.
      let inFlight: Promise<void> | null = null;
      fake.connect.mockImplementation(() => {
        inFlight ??= Promise.reject(new Error('refused')).finally(() => {
          inFlight = null;
        });
        return inFlight;
      });
      const conn = acquireClient(url);
      attach({}, conn);
      attach({}, acquireClient(url));
      attach({}, acquireClient(url));
      await advance(1);

      expect(fake.connect).toHaveBeenCalledTimes(3);
      expect(conn.failedDials).toBe(1);
    });

    it('resets when the connection comes up', async () => {
      const conn = acquireClient(url);
      attach({}, conn);
      await advance(1_000);
      expect(conn.failedDials).toBeGreaterThan(0);

      dialsSucceed = true;
      await advance(5_000);
      expect(conn.failedDials).toBe(0);
    });
  });

  describe('first dial', () => {
    it('is immediate on a connection with no history', () => {
      attach();
      expect(fake.connect).toHaveBeenCalledTimes(1);
    });

    it('backs off for a consumer attaching to a connection that has failed', async () => {
      attach();
      await advance(1_000);
      const dials = fake.connect.mock.calls.length;
      expect(dials).toBeGreaterThan(1);

      attach({}, acquireClient(url));
      expect(fake.connect).toHaveBeenCalledTimes(dials);
    });
  });
});
