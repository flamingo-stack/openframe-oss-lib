import type {
  ConnectionOptions,
  Consumer,
  ConsumerEvents,
  ConsumerMessages,
  DebugEvents,
  Events,
  JsMsg,
  MsgHdrs as NatsHeaders,
  Msg,
  NatsConnection,
  Subscription,
} from 'nats.ws';

export type { JsMsg, Msg, Subscription } from 'nats.ws';

export type JetStreamDeliverPolicy = 'new' | 'byStartSequence';

export interface JetStreamOrderedSubscribeOptions {
  streamName: string;
  filterSubject: string;
  deliverPolicy: JetStreamDeliverPolicy;
  /** Required when deliverPolicy === 'byStartSequence'. */
  optStartSeq?: number;
  /**
   * Auto-cleanup the ephemeral consumer after this idle time. Defaults to
   * nats.ws's own. Applies to the consumer created first: nats.ws only reads it
   * when the start sequence is the one it was built with, so every consumer it
   * recreates afterwards reverts to the library default.
   */
  inactiveThresholdMs?: number;
  /** AbortSignal to tear down the consumer. */
  signal?: AbortSignal;
  /**
   * The ordered consumer had to be rebuilt: the server dropped the ephemeral
   * consumer (its inactivity threshold elapsed while the page was suspended or
   * offline), heartbeats were missed, or a sequence gap was detected. nats.ws
   * recreates it from the last delivered sequence, so this is NOT an error —
   * but everything that aged out of the stream while it was gone is
   * unrecoverable from the tail, and no connection event announces it (the
   * WebSocket never dropped). Callers that keep persisted history alongside
   * the live tail must refetch it here, or they keep showing a snapshot from
   * before the gap.
   */
  onRecovered?: () => void;
}

export interface JetStreamSubscriptionHandle {
  unsubscribe(): void;
}

export interface NatsClientOptions {
  /**
   * NATS server URL(s), for example:
   * - "wss://nats.example.com:443"
   * - ["wss://nats-1.example.com:443", "wss://nats-2.example.com:443"]
   */
  servers: string | string[];

  /**
   * Connection name (shows up in NATS monitoring).
   */
  name?: string;

  /**
   * Auth options (pick one: token or user/pass).
   */
  token?: string;
  user?: string;
  pass?: string;

  /**
   * Reconnect behavior.
   */
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectTimeWaitMs?: number;

  /**
   * Exponential backoff for reconnect delays.
   * When set, uses `reconnectDelayHandler` from nats.ws under the hood,
   * overriding `reconnectTimeWaitMs`.
   */
  exponentialBackoff?: {
    /** Initial delay in ms (default: 1000) */
    initialDelayMs?: number;
    /** Maximum delay cap in ms (default: 30000) */
    maxDelayMs?: number;
    /** Multiplier per attempt (default: 2) */
    multiplier?: number;
    /** Add random jitter 0-50% of delay to prevent thundering herd (default: true) */
    jitter?: boolean;
  };

  /**
   * Ping behavior (keep-alive).
   */
  pingIntervalMs?: number;
  maxPingOut?: number;

  /**
   * Optional inbox prefix (useful if you want to isolate request/reply inboxes).
   */
  inboxPrefix?: string;

  /**
   * Connection timeout in milliseconds (maps to `nats.ws` connect option `timeout`).
   * If you see `NatsError: TIMEOUT` during connect, increase this.
   */
  connectTimeoutMs?: number;
}

export interface NatsSubscribeOptions {
  /**
   * Queue group for load-balancing messages across subscribers.
   */
  queue?: string;

  /**
   * Auto-unsubscribe after receiving this many messages.
   */
  max?: number;

  /**
   * Abort signal to stop message iteration and unsubscribe.
   */
  signal?: AbortSignal;
}

export type NatsHeadersInit = Record<string, string> | NatsHeaders | undefined;

export interface NatsPublishOptions {
  headers?: NatsHeadersInit;
}

export interface NatsRequestOptions {
  timeoutMs?: number;
  headers?: NatsHeadersInit;
}

export interface NatsSubscriptionHandle {
  readonly subscription: Subscription;
  unsubscribe(): void;
}

export type NatsStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'closed' | 'error';

export interface NatsStatusEvent {
  status: NatsStatus;
  data?: unknown;
}

export interface NatsClient {
  connect(): Promise<void>;
  close(): Promise<void>;

  isConnected(): boolean;

  publishBytes(subject: string, payload: Uint8Array, options?: NatsPublishOptions): void;
  publishString(subject: string, payload: string, options?: NatsPublishOptions): void;
  publishJson<T>(subject: string, payload: T, options?: NatsPublishOptions): void;

  requestBytes(subject: string, payload: Uint8Array, options?: NatsRequestOptions): Promise<Msg>;
  requestString(subject: string, payload: string, options?: NatsRequestOptions): Promise<string>;
  requestJson<TResponse, TRequest = unknown>(
    subject: string,
    payload: TRequest,
    options?: NatsRequestOptions,
  ): Promise<TResponse>;

  subscribeBytes(
    subject: string,
    onMessage: (msg: Msg) => void | Promise<void>,
    options?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle;
  subscribeString(
    subject: string,
    onMessage: (payload: string, msg: Msg) => void | Promise<void>,
    options?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle;
  subscribeJson<T>(
    subject: string,
    onMessage: (payload: T, msg: Msg) => void | Promise<void>,
    options?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle;

  /**
   * Subscribe to a JetStream subject via an ephemeral OrderedConsumer (no acks).
   * Use `optStartSeq` with `deliverPolicy: 'byStartSequence'` to resume from a known offset,
   * or `deliverPolicy: 'new'` to live-tail.
   */
  subscribeJetStreamOrdered(
    onMessage: (msg: JsMsg) => void | Promise<void>,
    options: JetStreamOrderedSubscribeOptions,
  ): Promise<JetStreamSubscriptionHandle>;

  onStatus(listener: (event: NatsStatusEvent) => void): () => void;
}

function assertClientSide(): void {
  // This wrapper is meant for browser/Tauri usage via WebSockets.
  // Keep it safe to import from Next.js server bundles by throwing only when used.
  if (typeof window === 'undefined') {
    throw new Error(
      'NATS client can only connect from the browser/runtime with WebSocket support (window is undefined).',
    );
  }
}

async function importNats() {
  // Browser/Tauri only: always use the websocket client (no Node-only deps).
  return import('nats.ws');
}

/**
 * The module's own shape, derived from the one dynamic `import()` above rather
 * than restated as `typeof import('nats.ws')` at every use site. Keeps a single
 * source of truth and stays a pure type — nothing here reaches the bundle.
 */
type NatsModule = Awaited<ReturnType<typeof importNats>>;

function toNatsHeaders(nats: NatsModule, init: NatsHeadersInit): NatsHeaders | undefined {
  if (!init) return undefined;
  if (typeof (init as NatsHeaders).get === 'function') return init as NatsHeaders;

  const h = nats.headers();
  for (const [k, v] of Object.entries(init as Record<string, string>)) {
    if (v !== undefined && v !== null) h.set(k, String(v));
  }
  return h;
}

/** Returns a cryptographically random float in [0, 1). */
function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / (0xffffffff + 1);
}

interface ExponentialBackoffHandle {
  handler: () => number;
  reset: () => void;
}

function createExponentialBackoffHandler(
  opts: NonNullable<NatsClientOptions['exponentialBackoff']>,
): ExponentialBackoffHandle {
  const initialDelay = opts.initialDelayMs ?? 1000;
  const maxDelay = opts.maxDelayMs ?? 30_000;
  const multiplier = opts.multiplier ?? 2;
  const jitter = opts.jitter ?? true;

  let attempt = 0;

  return {
    handler: (): number => {
      const delay = Math.min(initialDelay * multiplier ** attempt, maxDelay);
      attempt++;
      return jitter ? delay * (0.5 + cryptoRandom() * 0.5) : delay;
    },
    reset: () => {
      attempt = 0;
    },
  };
}

function mapOptionsToConnectionOptions(opts: NatsClientOptions, backoff?: ExponentialBackoffHandle): ConnectionOptions {
  return {
    servers: opts.servers,
    name: opts.name,
    token: opts.token,
    user: opts.user,
    pass: opts.pass,
    timeout: opts.connectTimeoutMs ?? 15000,
    reconnect: opts.reconnect ?? true,
    maxReconnectAttempts: opts.maxReconnectAttempts,
    reconnectTimeWait: opts.reconnectTimeWaitMs,
    reconnectDelayHandler: backoff?.handler,
    pingInterval: opts.pingIntervalMs,
    maxPingOut: opts.maxPingOut,
    inboxPrefix: opts.inboxPrefix,
  };
}

/**
 * Map a nats.ws status event onto our own status vocabulary.
 *
 * Exact enum matches, never substring tests. Substring matching reported
 * `staleConnection` and `client initiated reconnect` as CONNECTED — both
 * contain "connect" and neither contains "disconnect" — so the wrapper
 * announced a live connection at the exact moment the client had given up on
 * one. Downstream that is worse than silence: `NatsProvider` reads a
 * `connected` that follows an earlier connection as a RECONNECT and bumps
 * `reconnectionCount`, which every subscriber takes as "the tail came back" —
 * resubscribing against a dying client and refetching persisted history.
 * `staleConnection` is the one an idle mobile app hits routinely: no pong
 * within `pingInterval * maxPingOut`, i.e. after a spell in the background.
 *
 * `StaleConnection` maps to `disconnected` rather than being ignored on the
 * grounds that `Disconnect` follows it anyway — it does not always. nats.ws
 * tears the transport down by draining `bufferedAmount` first, and a
 * black-holed socket (no FIN, which is how a mobile link usually dies) never
 * drains, so `Disconnect` can fail to arrive at all. Reporting it is then the
 * only honest answer available: consumers stop trusting a tail the client has
 * already given up on. It does NOT by itself recover that connection — the
 * retry it arms short-circuits, because a protocol that never closed still
 * reports `isConnected()`. Getting the socket back from that state needs a
 * force-close path the client does not currently expose.
 *
 * The enums arrive as arguments rather than through a module-scope import
 * because `nats.ws` is loaded lazily (see {@link importNats}) to keep this
 * module safe to import from a Next server bundle. A hand-copied literal is
 * what this is undoing, so it is not reintroduced here.
 */
function mapNatsTypeToStatus(
  type: Events | DebugEvents,
  events: NatsModule['Events'],
  debugEvents: NatsModule['DebugEvents'],
): NatsStatus | null {
  switch (type) {
    case events.Disconnect:
      return 'disconnected';
    case events.Reconnect:
      return 'connected';
    case events.Error:
      return 'error';
    case debugEvents.Reconnecting:
    case debugEvents.ClientInitiatedReconnect:
      return 'reconnecting';
    case debugEvents.StaleConnection:
      return 'disconnected';
    // Events.Update (cluster gossip), Events.LDM and DebugEvents.PingTimer say
    // nothing about reachability.
    default:
      return null;
  }
}

/**
 * Report an ordered consumer rebuilding itself.
 *
 * nats.ws announces this on the message iterator's status channel and nowhere
 * else — the iterator keeps yielding, the WebSocket never drops, and nothing
 * consumes that channel unless someone asks for it. That silence is what lets a
 * tail resume after a suspended page having permanently missed whatever expired
 * from the stream meanwhile: the recreation resumes from the last delivered
 * sequence, so the gap is invisible from the tail alone.
 *
 * `recreatedEvent` is nats.ws's own enum value rather than a literal of ours: a
 * copy that drifted from the library would kill this signal silently, which is
 * the failure mode the signal exists to prevent.
 *
 * The status channel is closed along with the iterator, which ends this loop.
 */
function watchForRecovery(
  iter: ConsumerMessages,
  recreatedEvent: ConsumerEvents.OrderedConsumerRecreated,
  onRecovered?: () => void,
): void {
  if (!onRecovered) return;
  void (async () => {
    try {
      const status = await iter.status();
      for await (const event of status) {
        if (event.type !== recreatedEvent) continue;
        try {
          onRecovered();
        } catch (e) {
          // A caller that throws must not take the watch down with it — this
          // loop is the only thing reporting recoveries for this subscription.
          console.warn('[nats] onRecovered threw:', e);
        }
      }
    } catch {
      // Status ends with the subscription — nothing left to report.
    }
  })();
}

export function createNatsClient(options: NatsClientOptions): NatsClient {
  let nc: NatsConnection | null = null;
  let statusLoopAbort: AbortController | null = null;
  let connectInFlight: Promise<void> | null = null;

  const backoff = options.exponentialBackoff ? createExponentialBackoffHandler(options.exponentialBackoff) : undefined;

  const statusListeners = new Set<(event: NatsStatusEvent) => void>();

  function emitStatus(event: NatsStatusEvent) {
    for (const listener of statusListeners) {
      try {
        listener(event);
      } catch {
        // ignore listener failures
      }
    }
  }

  async function connect(): Promise<void> {
    if (nc && !nc.isClosed()) return;
    if (connectInFlight) {
      await connectInFlight;
      return;
    }
    assertClientSide();

    connectInFlight = (async () => {
      try {
        emitStatus({ status: 'connecting' });

        const nats = await importNats();
        const conn = await nats.connect(mapOptionsToConnectionOptions(options, backoff));
        nc = conn;

        emitStatus({ status: 'connected' });

        statusLoopAbort = new AbortController();
        const signal = statusLoopAbort.signal;

        (async () => {
          try {
            for await (const s of conn.status()) {
              if (signal.aborted) return;
              const mapped = mapNatsTypeToStatus(s.type, nats.Events, nats.DebugEvents);
              if (mapped) {
                if (mapped === 'connected' && backoff) {
                  backoff.reset();
                }
                emitStatus({ status: mapped, data: s.data });
              }
            }
          } catch (e) {
            if (!signal.aborted) {
              emitStatus({ status: 'error', data: e });

              if (nc === conn && conn.isClosed()) {
                nc = null;
                emitStatus({ status: 'closed' });
              }
            }
          }
        })().catch(() => {
          // ignore
        });
      } finally {
        connectInFlight = null;
      }
    })();

    await connectInFlight;
  }

  async function close(): Promise<void> {
    const conn = nc;
    nc = null;

    if (statusLoopAbort) {
      try {
        statusLoopAbort.abort();
      } catch {
        // ignore
      }
      statusLoopAbort = null;
    }

    if (!conn) return;
    try {
      await conn.drain();
    } finally {
      try {
        await conn.close();
      } finally {
        emitStatus({ status: 'closed' });
      }
    }
  }

  function requireConnection(): NatsConnection {
    if (!nc) throw new Error('NATS is not connected. Call client.connect() first.');
    return nc;
  }

  function isConnected(): boolean {
    return nc !== null && !nc.isClosed();
  }

  function publishBytes(subject: string, payload: Uint8Array, opts?: NatsPublishOptions): void {
    const conn = requireConnection();
    (async () => {
      const nats = await importNats();
      conn.publish(subject, payload, { headers: toNatsHeaders(nats, opts?.headers) });
    })().catch((e: unknown) => emitStatus({ status: 'error', data: e }));
  }

  function publishString(subject: string, payload: string, opts?: NatsPublishOptions): void {
    (async () => {
      const nats = await importNats();
      const sc = nats.StringCodec();
      publishBytes(subject, sc.encode(payload), opts);
    })().catch((e: unknown) => emitStatus({ status: 'error', data: e }));
  }

  function publishJson<T>(subject: string, payload: T, opts?: NatsPublishOptions): void {
    (async () => {
      const nats = await importNats();
      const jc = nats.JSONCodec<T>();
      publishBytes(subject, jc.encode(payload), opts);
    })().catch((e: unknown) => emitStatus({ status: 'error', data: e }));
  }

  async function requestBytes(subject: string, payload: Uint8Array, opts?: NatsRequestOptions): Promise<Msg> {
    const conn = requireConnection();
    const nats = await importNats();
    const msg = await conn.request(subject, payload, {
      timeout: opts?.timeoutMs ?? 2000,
      headers: toNatsHeaders(nats, opts?.headers),
    });
    return msg;
  }

  async function requestString(subject: string, payload: string, opts?: NatsRequestOptions): Promise<string> {
    const nats = await importNats();
    const sc = nats.StringCodec();
    const msg = await requestBytes(subject, sc.encode(payload), opts);
    return sc.decode(msg.data);
  }

  async function requestJson<TResponse, TRequest = unknown>(
    subject: string,
    payload: TRequest,
    opts?: NatsRequestOptions,
  ): Promise<TResponse> {
    const nats = await importNats();
    const reqCodec = nats.JSONCodec<TRequest>();
    const resCodec = nats.JSONCodec<TResponse>();
    const msg = await requestBytes(subject, reqCodec.encode(payload), opts);
    return resCodec.decode(msg.data);
  }

  function subscribeBytes(
    subject: string,
    onMessage: (msg: Msg) => void | Promise<void>,
    opts?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle {
    const conn = requireConnection();
    const sub = conn.subscribe(subject, { queue: opts?.queue });
    if (typeof opts?.max === 'number') sub.unsubscribe(opts.max);

    const abortController = new AbortController();
    const signal = opts?.signal ?? abortController.signal;

    (async () => {
      try {
        for await (const msg of sub) {
          if (signal.aborted) break;
          await onMessage(msg);
        }
      } catch (e) {
        emitStatus({ status: 'error', data: e });
      } finally {
        try {
          sub.unsubscribe();
        } catch {
          // ignore
        }
      }
    })().catch((e: unknown) => emitStatus({ status: 'error', data: e }));

    return {
      subscription: sub,
      unsubscribe() {
        try {
          abortController.abort();
        } catch {
          // ignore
        }
        try {
          sub.unsubscribe();
        } catch {
          // ignore
        }
      },
    };
  }

  function subscribeString(
    subject: string,
    onMessage: (payload: string, msg: Msg) => void | Promise<void>,
    opts?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle {
    return subscribeBytes(
      subject,
      async msg => {
        const nats = await importNats();
        const sc = nats.StringCodec();
        await onMessage(sc.decode(msg.data), msg);
      },
      opts,
    );
  }

  function subscribeJson<T>(
    subject: string,
    onMessage: (payload: T, msg: Msg) => void | Promise<void>,
    opts?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle {
    return subscribeBytes(
      subject,
      async msg => {
        const nats = await importNats();
        const jc = nats.JSONCodec<T>();
        await onMessage(jc.decode(msg.data), msg);
      },
      opts,
    );
  }

  async function subscribeJetStreamOrdered(
    onMessage: (msg: JsMsg) => void | Promise<void>,
    opts: JetStreamOrderedSubscribeOptions,
  ): Promise<JetStreamSubscriptionHandle> {
    const conn = requireConnection();
    if (opts.signal?.aborted) {
      return { unsubscribe() {} };
    }

    const nats = await importNats();
    if (opts.signal?.aborted) {
      return { unsubscribe() {} };
    }

    const js = conn.jetstream();
    const consumer: Consumer = await js.consumers.get(opts.streamName, {
      filterSubjects: opts.filterSubject,
      deliver_policy: nats.DeliverPolicy.StartSequence,
      opt_start_seq: opts.optStartSeq ?? 0,
      // Milliseconds, NOT nanoseconds: nats.ws runs this through its own
      // `nanos()` before it reaches the server. Pre-converting here multiplied
      // it by 1e6 twice, putting the threshold ~9.5 years out — so the ephemeral
      // consumer never expired. Two consequences, both silent: every reconnect
      // and dialog switch orphaned a consumer server-side, and a client that
      // stopped pulling never got the `consumer deleted` that drives the ordered
      // consumer's self-repair. Undefined stays undefined so nats.ws applies its
      // own default rather than a copy of it.
      inactive_threshold: opts.inactiveThresholdMs,
    });

    const iterRef: { current: ConsumerMessages | null } = { current: null };
    let closed = false;

    const onAbort = () => {
      void teardown();
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    async function teardown(): Promise<void> {
      if (closed) return;
      closed = true;
      opts.signal?.removeEventListener('abort', onAbort);
      const iter = iterRef.current;
      iterRef.current = null;
      if (iter) {
        try {
          await iter.close();
        } catch {
          // ignore
        }
      }
    }

    if (opts.signal?.aborted) {
      void teardown();
      return { unsubscribe() {} };
    }

    (async () => {
      try {
        const iter = await consumer.consume();
        if (closed) {
          try {
            await iter.close();
          } catch {
            // ignore
          }
          return;
        }
        iterRef.current = iter;
        watchForRecovery(iter, nats.ConsumerEvents.OrderedConsumerRecreated, opts.onRecovered);
        for await (const msg of iter) {
          if (closed) break;
          try {
            await onMessage(msg);
          } catch (e) {
            emitStatus({ status: 'error', data: e });
          }
        }
      } catch (e) {
        if (!closed) emitStatus({ status: 'error', data: e });
      }
    })().catch((e: unknown) => emitStatus({ status: 'error', data: e }));

    return {
      unsubscribe() {
        void teardown();
      },
    };
  }

  function onStatus(listener: (event: NatsStatusEvent) => void): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  }

  return {
    connect,
    close,
    isConnected,
    publishBytes,
    publishString,
    publishJson,
    requestBytes,
    requestString,
    requestJson,
    subscribeBytes,
    subscribeString,
    subscribeJson,
    subscribeJetStreamOrdered,
    onStatus,
  };
}
