import { createNatsClient, type NatsClient, type NatsStatus, type NatsStatusEvent } from './nats';

export const NATS_DEFAULTS = {
  SHARED_CLOSE_DELAY_MS: 3000,
  CONNECT_TIMEOUT_MS: 10_000,
  PING_INTERVAL_MS: 30_000,
  MAX_PING_OUT: 3,
  RETRY_INITIAL_DELAY_MS: 1000,
  RETRY_MAX_DELAY_MS: 30_000,
  RETRY_MULTIPLIER: 2,
} as const;

export interface NatsReconnectionBackoff {
  /** Number of fast retries before exponential phase kicks in. Default: 0. */
  fastRetries?: number;
  /** Delay used during the fast-retry phase. Default: RETRY_INITIAL_DELAY_MS. */
  fastRetryDelayMs?: number;
  /** Base delay for the exponential phase. Default: RETRY_INITIAL_DELAY_MS. */
  initialDelayMs?: number;
  /** Upper cap on any single retry delay. Default: RETRY_MAX_DELAY_MS. */
  maxDelayMs?: number;
  /** Per-attempt multiplier during exponential phase. Default: RETRY_MULTIPLIER. */
  multiplier?: number;
}

export interface SharedConnection {
  wsUrl: string;
  client: NatsClient;
  refCount: number;
  closeTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  /**
   * The lifecycle driving reconnect, held as its own `scheduleRetry`. When set,
   * other consumers observe status only and skip their own scheduleRetry —
   * otherwise every disconnect starts one backoff schedule per attached
   * consumer, all dialling the same connection on their own clocks.
   */
  retryOwner: (() => void) | null;
  /**
   * The `scheduleRetry` of every lifecycle currently observing this connection,
   * in attach order — the same value that goes into `retryOwner`, so a
   * lifecycle has one identity rather than two. Only the owner drives
   * reconnect, so when it gives the loop up the roster is what a successor is
   * found in; see {@link handOffRetry}.
   */
  retrySchedulers: Set<() => void>;
}

export interface AcquireClientOptions {
  name?: string;
  user?: string;
  pass?: string;
  connectTimeoutMs?: number;
  pingIntervalMs?: number;
  maxPingOut?: number;
}

export interface ReleaseClientOptions {
  delayMs?: number;
}

// One shared connection PER URL. The previous single-slot implementation
// force-closed whatever was connected the moment any consumer acquired a
// DIFFERENT URL — even with live refs on it. With two chat surfaces on
// distinct endpoints (`/ws/nats` client chat vs `/ws/nats-api` dashboard)
// mounted at once, each acquire killed the other's socket, and the loser's
// retry loop self-cancelled (connection identity mismatch) leaving a dead
// subscription that silently received nothing.
const connections = new Map<string, SharedConnection>();

/** Legacy accessor from the single-slot era: returns the first live shared
 *  connection, or null. With MULTIPLE URLs connected (e.g. `/ws/nats` client
 *  chat + `/ws/nats-api` dashboard mounted together) "first" is whichever
 *  surface acquired first — an arbitrary, mount-order-dependent answer.
 *  Prefer `getSharedConnectionFor(url)`; this stays only for external
 *  registry-pinned consumers of the old single-connection API. */
export function getSharedConnection(): SharedConnection | null {
  const first = connections.values().next();
  return first.done ? null : first.value;
}

export function acquireClient(url: string, opts?: AcquireClientOptions): SharedConnection {
  let conn = connections.get(url);

  if (!conn) {
    const {
      name = 'openframe-frontend',
      user = 'machine',
      pass = '',
      connectTimeoutMs = NATS_DEFAULTS.CONNECT_TIMEOUT_MS,
      pingIntervalMs = NATS_DEFAULTS.PING_INTERVAL_MS,
      maxPingOut = NATS_DEFAULTS.MAX_PING_OUT,
    } = opts ?? {};

    const client = createNatsClient({
      servers: url,
      name,
      user,
      pass,
      connectTimeoutMs,
      reconnect: false,
      pingIntervalMs,
      maxPingOut,
    });

    conn = {
      wsUrl: url,
      client,
      refCount: 0,
      closeTimer: null,
      retryTimer: null,
      retryOwner: null,
      retrySchedulers: new Set(),
    };
    connections.set(url, conn);
  }

  conn.refCount += 1;
  if (conn.closeTimer) {
    clearTimeout(conn.closeTimer);
    conn.closeTimer = null;
  }
  return conn;
}

export function releaseClient(url: string, opts?: ReleaseClientOptions): void {
  const conn = connections.get(url);
  if (!conn) return;

  conn.refCount = Math.max(0, conn.refCount - 1);
  if (conn.refCount > 0) return;

  const delay = opts?.delayMs ?? NATS_DEFAULTS.SHARED_CLOSE_DELAY_MS;
  conn.closeTimer = setTimeout(() => {
    conn.closeTimer = null;
    // A new acquire may have raced in during the grace period.
    if (conn.refCount > 0) return;
    if (connections.get(url) === conn) {
      connections.delete(url);
    }
    if (conn.retryTimer) {
      clearTimeout(conn.retryTimer);
      conn.retryTimer = null;
    }
    void conn.client.close().catch(() => {});
  }, delay);
}

export function getSharedConnectionFor(url: string | null | undefined): SharedConnection | null {
  if (!url) return null;
  return connections.get(url) ?? null;
}

// ---------------------------------------------------------------------------
// Connection lifecycle: retry + status loop, shared by NatsProvider and the
// chat hooks. Every consumer that wants to observe or drive reconnect calls
// startConnectionLifecycle(). The first to claim retryOwner runs the actual
// retry loop; later attachers observe status only. When the owner gives the
// loop up it is handed to a survivor if the connection still needs one; while
// the connection is healthy no handoff is needed, because the next status
// event lets a survivor claim ownership opportunistically inside
// scheduleRetry.
// ---------------------------------------------------------------------------

export interface ConnectionLifecycleOptions {
  conn: SharedConnection;
  wsUrl: string;
  onBeforeReconnect?: () => Promise<void> | void;
  backoff?: NatsReconnectionBackoff;
  getFreshUrl: () => string | null;
  /** Called on every status change (after closed-guard). */
  onStatusChange?: (status: NatsStatus, evt: NatsStatusEvent) => void;
  /**
   * Decide which statuses should trigger a retry attempt. Defaults to closed +
   * disconnected. Override to skip 'error' (JetStream protocol errors that
   * don't close the WS) or include it.
   */
  shouldRetryOn?: (status: NatsStatus) => boolean;
}

export interface ConnectionLifecycleHandle {
  /** Stop observing status, clear any pending retry, release ownership if held. */
  stop(): void;
}

const defaultShouldRetryOn = (status: NatsStatus) => status === 'closed' || status === 'disconnected';

/**
 * Offer the retry loop to another lifecycle on this connection.
 *
 * A retry is only ever armed from a status event or a failed dial, and a
 * connection that is already down produces neither on its own — so whenever
 * the owner gives the loop up while the connection still needs dialling, a
 * successor has to be pushed rather than left waiting for an event that is not
 * coming.
 *
 * Candidates that cannot service this URL decline inside `scheduleRetry`, so
 * this walks the roster until one actually takes it. Callers must clear any
 * timer of their own first: a successor that claims while a timer is still
 * armed will not arm one, and the departing owner's timer no longer speaks for
 * the connection.
 */
function handOffRetry(conn: SharedConnection): void {
  for (const takeOver of conn.retrySchedulers) {
    takeOver();
    if (conn.retryOwner) return;
  }
}

export function startConnectionLifecycle(options: ConnectionLifecycleOptions): ConnectionLifecycleHandle {
  const { conn, wsUrl } = options;
  let closed = false;
  let retryAttempt = 0;

  function emitSynthetic(status: NatsStatus) {
    if (closed) return;
    options.onStatusChange?.(status, { status });
    if (status === 'connected') {
      retryAttempt = 0;
    }
  }

  // A lifecycle's identity IS its `scheduleRetry`: that function goes on the
  // connection's roster and, for whichever lifecycle holds the loop, into
  // `retryOwner` — one identity, not two.
  conn.retrySchedulers.add(scheduleRetry);
  if (!conn.retryOwner) conn.retryOwner = scheduleRetry;

  function scheduleRetry() {
    if (closed) return;
    if (getSharedConnectionFor(wsUrl) !== conn) return;
    // This lifecycle now wants a different URL, so it must not drive this
    // connection — not from its own status events, and not as a handoff
    // successor. Without the guard, two consumers that had both moved on
    // passed ownership back and forth indefinitely, running onBeforeReconnect
    // — a token refresh in the real callers — on every pass and dialling
    // nothing. The armed callback re-checks, because the URL can move between
    // arming and firing.
    if (options.getFreshUrl() !== wsUrl) return;
    if (!conn.retryOwner) conn.retryOwner = scheduleRetry;
    if (conn.retryOwner !== scheduleRetry) return;

    // One outage can raise more than one status: nats.ws reports
    // `staleConnection` and then, once the transport is down, `disconnect`.
    // Re-arming on the second would spend a backoff tier on the same outage —
    // on the defaults, waiting 2000ms where the caller asked for 1000. The
    // armed timer re-validates everything when it fires, so the first one
    // scheduled for an outage is always the right one to keep.
    if (conn.retryTimer) return;

    const cfg = options.backoff ?? {};
    const fastRetries = cfg.fastRetries ?? 0;
    const fastDelay = cfg.fastRetryDelayMs ?? NATS_DEFAULTS.RETRY_INITIAL_DELAY_MS;
    const baseDelay = cfg.initialDelayMs ?? NATS_DEFAULTS.RETRY_INITIAL_DELAY_MS;
    const maxDelay = cfg.maxDelayMs ?? NATS_DEFAULTS.RETRY_MAX_DELAY_MS;
    const multiplier = cfg.multiplier ?? NATS_DEFAULTS.RETRY_MULTIPLIER;

    const delay =
      retryAttempt < fastRetries
        ? fastDelay
        : Math.min(baseDelay * multiplier ** (retryAttempt - fastRetries), maxDelay);
    const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
    retryAttempt++;

    // The retry body is a named async function rather than the timer callback
    // itself: `setTimeout` discards whatever its callback returns, so an async
    // callback's rejection has nowhere to go. Everything that can realistically
    // throw in here is already caught below, so this is the last-resort net —
    // but the retry loop is what brings the connection back, and a silent
    // unhandled rejection in it strands every consumer offline.
    const runRetry = async () => {
      conn.retryTimer = null;
      if (closed) return;
      if (getSharedConnectionFor(wsUrl) !== conn) return;

      // Nothing to reconnect. Reached when the dial that was already in flight
      // succeeded while this retry sat in its backoff — a handoff during a
      // healthy first connect is enough to get here — and `onBeforeReconnect`
      // is a token refresh in the real callers, so it must not run on a
      // connection that came back on its own.
      if (conn.client.isConnected()) {
        retryAttempt = 0;
        return;
      }

      try {
        await options.onBeforeReconnect?.();
      } catch {
        // continue regardless of token-refresh outcome
      }
      if (closed) return;
      if (getSharedConnectionFor(wsUrl) !== conn) return;

      const freshUrl = options.getFreshUrl();
      if (freshUrl !== wsUrl) {
        // This lifecycle has moved to a different URL, so it must not dial this
        // connection again while holding the loop — that is the dead end the
        // rest of this module exists to avoid. Give the loop up and push it to
        // someone still on this URL.
        if (conn.retryOwner === scheduleRetry) {
          conn.retryOwner = null;
          // A status that landed while the refresh above was awaited can have
          // armed a new timer under this ownership. It belongs to a lifecycle
          // that is leaving, and a successor claiming while it is armed would
          // return early believing the loop is covered — then this timer fires,
          // finds someone else owns the loop, and bails without handing on.
          if (conn.retryTimer) {
            clearTimeout(conn.retryTimer);
            conn.retryTimer = null;
          }
          handOffRetry(conn);
        }
        return;
      }

      try {
        await conn.client.connect();
        if (!closed && getSharedConnectionFor(wsUrl) === conn) {
          retryAttempt = 0;
        }
      } catch {
        if (!closed && getSharedConnectionFor(wsUrl) === conn) {
          scheduleRetry();
        }
      }
    };

    conn.retryTimer = setTimeout(() => {
      runRetry().catch((err: unknown) => {
        console.warn('[nats] retry attempt threw:', err);
      });
    }, jitteredDelay);
  }

  const shouldRetryOn = options.shouldRetryOn ?? defaultShouldRetryOn;

  const unsubStatus = conn.client.onStatus(evt => {
    if (closed) return;
    options.onStatusChange?.(evt.status, evt);
    if (evt.status === 'connected') {
      retryAttempt = 0;
    }
    if (shouldRetryOn(evt.status)) {
      scheduleRetry();
    }
  });

  if (conn.client.isConnected()) {
    emitSynthetic('connected');
  }

  // Dial through the client rather than caching a promise on the connection.
  // A `conn.connectPromise` used to be assigned here with `||=` and then left
  // in place after a SUCCESSFUL connect, so it doubled as "this connection has
  // been dialled at some point": a consumer that acquired a still-cached
  // connection whose socket had since died joined that long-settled promise
  // instead of dialling. No connect, no failure, so nothing scheduled a retry,
  // and no status event was coming to arm one either — the connection stayed
  // dead for as long as anything held a reference to it. `NatsClient.connect()`
  // already short-circuits on a live connection and joins its own in-flight
  // dial, so the second copy of that bookkeeping bought nothing.
  void (async () => {
    try {
      await conn.client.connect();
    } catch {
      if (closed) return;

      emitSynthetic('disconnected');
      scheduleRetry();
    }
  })();

  return {
    stop() {
      closed = true;
      unsubStatus();
      conn.retrySchedulers.delete(scheduleRetry);

      if (conn.retryOwner !== scheduleRetry) {
        // Not ours to cancel. `retryTimer` lives on the CONNECTION, and
        // clearing it unconditionally cancelled the owner's armed retry — so
        // any consumer merely re-running its effect (an `enabled` toggle, a
        // dialog closing, a route change) during a backoff killed reconnect
        // for everyone. Nothing rescheduled it either, for the reason
        // handOffRetry exists. The connection stayed down for good.
        return;
      }

      conn.retryOwner = null;
      const wasRetrying = conn.retryTimer !== null;
      if (conn.retryTimer) {
        clearTimeout(conn.retryTimer);
        conn.retryTimer = null;
      }

      // A healthy connection with nothing armed needs no successor: the next
      // disconnect lets a survivor claim opportunistically. `wasRetrying` is
      // read before the clearTimeout above, and the remaining case — the timer
      // already fired and its callback is mid-dial — is caught by the
      // connection not being connected. The successor backs off on its OWN
      // attempt counter, which is zero unless it has driven the loop before.
      if (!wasRetrying && conn.client.isConnected()) return;
      handOffRetry(conn);
    },
  };
}
