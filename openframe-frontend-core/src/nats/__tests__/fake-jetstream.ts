/**
 * In-memory JetStream for driving `subscribeJetStreamOrdered` and the hooks on
 * top of it, through a `connect` that replaces nats.ws's.
 *
 * The consumer CONFIG is not re-implemented: it is what nats.ws's own
 * `OrderedPullConsumerImpl.getConsumerOpts` builds before `CONSUMER.CREATE`
 * (loaded from the installed package past its exports map), so a nats.ws quirk
 * — a start sequence of 0 becoming 1, say — shows up here as it does against a
 * real server. Only the server half is simulated, with JetStream's semantics:
 * `by_start_sequence` delivers every retained message from `opt_start_seq` on,
 * `new` delivers nothing retained, and each delivered message carries the
 * `pending` count the server would put in its reply subject.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { ConsumerEvents } from 'nats.ws';

interface OrderedConsumerConfigBuilder {
  cursor: { stream_seq: number };
  getConsumerOpts: (seq: number) => ServerConsumerConfig;
}

const loadCjs = createRequire(import.meta.url);
const { OrderedPullConsumerImpl } = loadCjs(
  join(dirname(loadCjs.resolve('nats.ws')), '../lib/jetstream/consumer.js'),
) as {
  OrderedPullConsumerImpl: new (
    api: unknown,
    stream: string,
    opts: Record<string, unknown>,
  ) => OrderedConsumerConfigBuilder;
};

export interface ServerConsumerConfig {
  name: string;
  deliver_policy: string;
  opt_start_seq?: number;
  filter_subject?: string;
}

/** What nats.ws sends the server for these `consumers.get` options. */
export function orderedConsumerServerConfig(stream: string, opts: Record<string, unknown>): ServerConsumerConfig {
  const impl = new OrderedPullConsumerImpl({}, stream, opts);
  // `reset()` → `resetConsumer(cursor.stream_seq + 1)`, which maps 0 to 1.
  const seq = impl.cursor.stream_seq + 1;
  return impl.getConsumerOpts(seq === 0 ? 1 : seq);
}

interface StoredMsg {
  seq: number;
  subject: string;
  data: Uint8Array;
  time: number;
}

interface StatusEvent {
  type: string;
  data?: unknown;
}

/** A pull-style queue that ends when closed. */
class Queue<T> {
  private items: T[] = [];
  private waiter: ((r: IteratorResult<T>) => void) | null = null;
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w({ value: item, done: false });
    } else this.items.push(item);
  }

  close(): void {
    this.closed = true;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () =>
        new Promise<IteratorResult<T>>(resolve => {
          const item = this.items.shift();
          if (item !== undefined) resolve({ value: item, done: false });
          else if (this.closed) resolve({ value: undefined, done: true });
          else this.waiter = resolve;
        }),
    };
  }
}

interface LiveConsumer {
  filter: string;
  conn: object;
  isDropped: () => boolean;
  drop: () => void;
  deliver: (m: StoredMsg) => void;
  recreate: () => void;
  end: () => void;
}

export class FakeJetStream {
  msgs: StoredMsg[] = [];
  nextSeq = 1;
  maxAgeMs = 10 * 60_000;
  createdConsumers: ServerConsumerConfig[] = [];
  /** Latency between CONSUMER.CREATE and the first delivered message. */
  consumeDelayMs = 0;
  /** CONSUMER lookups fail (e.g. STREAM.INFO while JetStream recovers after a restart). */
  failConsumerLookup = false;
  /** Every `consumers.get`, failed ones included. */
  consumerLookups = 0;
  /** `consume()` fails (nats.ws gave up creating the consumer). */
  failConsume = false;
  private live = new Set<LiveConsumer>();
  private conns = new Set<{ drop: () => void }>();
  private consumerSerial = 0;

  publish(subject: string, payload: unknown): number {
    const msg: StoredMsg = {
      seq: this.nextSeq++,
      subject,
      data: new TextEncoder().encode(JSON.stringify(payload)),
      time: Date.now(),
    };
    this.msgs.push(msg);
    for (const c of this.live) if (c.filter === subject && !c.isDropped()) c.deliver(msg);
    return msg.seq;
  }

  /** Burn stream sequences on another subject (other dialogs share the stream). */
  publishNoise(count: number): void {
    for (let i = 0; i < count; i++) this.publish('chat.other-dialog.admin-message', { type: 'TEXT', text: 'x' });
  }

  /** Server-side connection loss: every socket closes, its consumers stop. */
  disconnectAll(): void {
    for (const c of [...this.conns]) c.drop();
  }

  /** The server drops every consumer — a page suspended past the inactivity
   *  threshold — and what is published meanwhile is not delivered. */
  dropConsumers(): void {
    for (const c of this.live) c.drop();
  }

  /** nats.ws rebuilds every consumer from its cursor. */
  recreateConsumers(): void {
    for (const c of [...this.live]) c.recreate();
  }

  private retainedAfter(filter: string, firstSeq: number): StoredMsg[] {
    const floor = Date.now() - this.maxAgeMs;
    return this.msgs.filter(m => m.subject === filter && m.time >= floor && m.seq >= firstSeq);
  }

  /** The `nats.ws` `connect()` replacement. */
  connect = () => {
    let closed = false;
    const status = new Queue<StatusEvent>();
    const token = {};
    const connEntry = {
      drop: () => {
        closed = true;
        this.conns.delete(connEntry);
        for (const c of [...this.live]) if (c.conn === token) c.end();
        status.push({ type: 'disconnect', data: 'fake' });
      },
    };
    this.conns.add(connEntry);
    return Promise.resolve({
      isClosed: () => closed,
      closed: () => new Promise(() => {}),
      drain: () => {
        closed = true;
        return Promise.resolve();
      },
      close: () => {
        closed = true;
        return Promise.resolve();
      },
      status: () => status,
      publish: () => {},
      subscribe: () => ({ unsubscribe() {}, [Symbol.asyncIterator]: async function* () {} }),
      jetstream: () => ({
        consumers: {
          get: (stream: string, opts: Record<string, unknown>) => {
            this.consumerLookups += 1;
            if (this.failConsumerLookup) return Promise.reject(new Error('JetStream not available'));
            const config = orderedConsumerServerConfig(stream, opts);
            this.createdConsumers.push(config);
            const filter = String(opts.filterSubjects);
            const messages = new Queue<unknown>();
            const consumerStatus = new Queue<StatusEvent>();
            const toJsMsg = (m: StoredMsg, pending: number) => ({
              data: m.data,
              subject: m.subject,
              info: { streamSequence: m.seq, pending },
            });

            // Highest stream sequence handed to the client — where a recreation resumes.
            let cursor = 0;
            let dropped = false;
            let info = { name: config.name, num_pending: 0 };

            /** Queue a backlog, each message carrying what is still behind it. */
            const deliverBacklog = (backlog: StoredMsg[]) => {
              backlog.forEach((m, i) => {
                cursor = m.seq;
                messages.push(toJsMsg(m, backlog.length - 1 - i));
              });
            };

            const entry: LiveConsumer = {
              filter,
              conn: token,
              isDropped: () => dropped,
              drop: () => {
                dropped = true;
              },
              deliver: m => {
                cursor = m.seq;
                messages.push(toJsMsg(m, 0));
              },
              recreate: () => {
                const name = `${config.name}-recreated-${++this.consumerSerial}`;
                const resumed = this.retainedAfter(filter, cursor + 1);
                dropped = false;
                // nats.ws announces the new consumer, then records it.
                consumerStatus.push({ type: ConsumerEvents.OrderedConsumerRecreated, data: name });
                void Promise.resolve().then(() => {
                  info = { name, num_pending: resumed.length };
                  setTimeout(() => deliverBacklog(resumed), this.consumeDelayMs);
                });
              },
              end: () => {
                this.live.delete(entry);
                messages.close();
                consumerStatus.close();
              },
            };

            return Promise.resolve({
              info: () => Promise.resolve(info),
              consume: () => {
                if (this.failConsume) return Promise.reject(new Error('consumer could not be created'));
                const backlog =
                  config.deliver_policy === 'by_start_sequence'
                    ? this.retainedAfter(filter, config.opt_start_seq ?? 1)
                    : config.deliver_policy === 'all'
                      ? this.retainedAfter(filter, 1)
                      : [];
                cursor = backlog.length > 0 ? 0 : this.nextSeq - 1;
                info = { name: config.name, num_pending: backlog.length };
                this.live.add(entry);
                if (backlog.length > 0) {
                  if (this.consumeDelayMs > 0) setTimeout(() => deliverBacklog(backlog), this.consumeDelayMs);
                  else deliverBacklog(backlog);
                }
                return Promise.resolve({
                  status: () => Promise.resolve(consumerStatus),
                  close: () => {
                    entry.end();
                    return Promise.resolve();
                  },
                  [Symbol.asyncIterator]: () => messages[Symbol.asyncIterator](),
                });
              },
            });
          },
        },
      }),
    });
  };
}
