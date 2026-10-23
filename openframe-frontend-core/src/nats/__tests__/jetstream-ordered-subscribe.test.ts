/**
 * `subscribeJetStreamOrdered` against an in-memory JetStream whose consumer
 * config is built by nats.ws itself (see `fake-jetstream.ts`).
 *
 * Pins the two halves of the Mingo "burst of old messages" fix that live here:
 * a live tail that is really a live tail (it used to replay the stream's whole
 * retention window), and a caught-up signal that says when a consumer's
 * backlog is in, which is when a host may refetch history without racing the
 * replay.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNatsClient, type JetStreamSubscriptionHandle, type NatsClient } from '../nats';
import { FakeJetStream, orderedConsumerServerConfig } from './fake-jetstream';

const server = vi.hoisted(() => ({ current: null as unknown as FakeJetStream }));

vi.mock('nats.ws', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  connect: () => server.current.connect(),
}));

const SUBJECT = 'chat.dialog-1.admin-message';

let client: NatsClient;
let handle: JetStreamSubscriptionHandle | null = null;
/** What the subscription reported, in order: `msg:<seq>`, `caught-up`, `recovered`. */
let log: string[];

async function subscribe(options: { deliverPolicy: 'new' | 'byStartSequence'; optStartSeq?: number }) {
  handle = await client.subscribeJetStreamOrdered(
    msg => {
      log.push(`msg:${msg.info.streamSequence}`);
    },
    {
      streamName: 'CHAT_CHUNKS',
      filterSubject: SUBJECT,
      ...options,
      onCaughtUp: () => log.push('caught-up'),
      onRecovered: () => log.push('recovered'),
    },
  );
}

beforeEach(async () => {
  server.current = new FakeJetStream();
  log = [];
  client = createNatsClient({ servers: 'ws://fake' });
  await client.connect();
});

afterEach(() => {
  handle?.unsubscribe();
  handle = null;
});

describe('nats.ws ordered consumer config (the library itself)', () => {
  it('turns a start sequence of 0 into 1: everything the stream retains', () => {
    expect(
      orderedConsumerServerConfig('CHAT_CHUNKS', {
        filterSubjects: SUBJECT,
        deliver_policy: 'by_start_sequence',
        opt_start_seq: 0,
      }),
    ).toMatchObject({ deliver_policy: 'by_start_sequence', opt_start_seq: 1 });
  });
});

describe('deliver policy', () => {
  it("'new' creates a DeliverPolicy.New consumer and replays nothing retained", async () => {
    for (let i = 0; i < 5; i++) server.current.publish(SUBJECT, { type: 'TEXT', text: `old-${i}` });

    await subscribe({ deliverPolicy: 'new' });
    await vi.waitFor(() => expect(log).toContain('caught-up'));
    const live = server.current.publish(SUBJECT, { type: 'TEXT', text: 'live' });
    await vi.waitFor(() => expect(log).toContain(`msg:${live}`));

    expect(server.current.createdConsumers[0]).toMatchObject({ deliver_policy: 'new' });
    expect(server.current.createdConsumers[0]).not.toHaveProperty('opt_start_seq');
    expect(log).toEqual(['caught-up', `msg:${live}`]);
  });

  it("'byStartSequence' resumes at the sequence asked for", async () => {
    const seqs = [0, 1, 2, 3].map(i => server.current.publish(SUBJECT, { type: 'TEXT', text: `m-${i}` }));

    await subscribe({ deliverPolicy: 'byStartSequence', optStartSeq: seqs[2] });
    await vi.waitFor(() => expect(log).toContain('caught-up'));

    expect(server.current.createdConsumers[0]).toMatchObject({
      deliver_policy: 'by_start_sequence',
      opt_start_seq: seqs[2],
    });
    expect(log).toEqual([`msg:${seqs[2]}`, `msg:${seqs[3]}`, 'caught-up']);
  });
});

describe('onCaughtUp', () => {
  it('fires after the last backlog message has been handled, and not again for live ones', async () => {
    const seqs = [0, 1, 2].map(i => {
      server.current.publishNoise(2);
      return server.current.publish(SUBJECT, { type: 'TEXT', text: `m-${i}` });
    });

    await subscribe({ deliverPolicy: 'byStartSequence', optStartSeq: 1 });
    await vi.waitFor(() => expect(log).toContain('caught-up'));
    const live = server.current.publish(SUBJECT, { type: 'TEXT', text: 'live' });
    await vi.waitFor(() => expect(log).toContain(`msg:${live}`));

    expect(log).toEqual([...seqs.map(s => `msg:${s}`), 'caught-up', `msg:${live}`]);
  });

  it('fires once the consumer exists when nothing is pending at creation', async () => {
    server.current.publish(SUBJECT, { type: 'TEXT', text: 'already seen' });

    await subscribe({ deliverPolicy: 'byStartSequence', optStartSeq: server.current.nextSeq });
    await vi.waitFor(() => expect(log).toEqual(['caught-up']));
  });

  it('fires again after a recreated consumer has replayed what it resumed with', async () => {
    const first = server.current.publish(SUBJECT, { type: 'TEXT', text: 'first' });
    await subscribe({ deliverPolicy: 'byStartSequence', optStartSeq: first });
    await vi.waitFor(() => expect(log).toEqual([`msg:${first}`, 'caught-up']));

    // Published while the consumer is gone: the recreation resumes with them.
    server.current.dropConsumers();
    const missed = [0, 1].map(i => server.current.publish(SUBJECT, { type: 'TEXT', text: `missed-${i}` }));
    server.current.consumeDelayMs = 20;
    server.current.recreateConsumers();
    await vi.waitFor(() => expect(log.filter(e => e === 'caught-up')).toHaveLength(2));

    expect(log).toEqual([`msg:${first}`, 'caught-up', 'recovered', ...missed.map(s => `msg:${s}`), 'caught-up']);
  });

  it('fires again after a recreation with nothing to replay', async () => {
    const first = server.current.publish(SUBJECT, { type: 'TEXT', text: 'first' });
    await subscribe({ deliverPolicy: 'byStartSequence', optStartSeq: first });
    await vi.waitFor(() => expect(log).toEqual([`msg:${first}`, 'caught-up']));

    server.current.dropConsumers();
    server.current.recreateConsumers();

    await vi.waitFor(() => expect(log).toEqual([`msg:${first}`, 'caught-up', 'recovered', 'caught-up']));
  });
});
