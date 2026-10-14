/**
 * `caughtUpCount` of `useJetStreamDialogSubscription`: the moment a host may
 * refetch persisted history after a gap.
 *
 * Hosts used to refetch on `reconnectionCount`, i.e. while the resumed
 * consumer was still replaying what it missed. A refetch that won that race
 * merged without the replayed turns, and the replay then rendered every one of
 * them a second time (the Mingo "burst of old messages" report). The counter
 * may only move once the replay is in.
 */
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeJetStream } from '../../../../nats/__tests__/fake-jetstream';
import type { UseJetStreamDialogSubscriptionReturn } from '../../types';
import { useJetStreamDialogSubscription } from '../use-jetstream-dialog-subscription';

const server = vi.hoisted(() => ({ current: null as unknown as FakeJetStream }));

vi.mock('nats.ws', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  connect: () => server.current.connect(),
}));

const DIALOG = 'dialog-1';
const SUBJECT = `chat.${DIALOG}.admin-message`;

/** Shared connections are cached per URL in module state: one URL per test. */
let testIndex = 0;
let log: string[];
let latest: UseJetStreamDialogSubscriptionReturn;

function Probe({ url, optStartSeq }: { url: string; optStartSeq: number | null }) {
  const result = useJetStreamDialogSubscription({
    enabled: true,
    dialogId: DIALOG,
    topic: 'admin-message',
    optStartSeq,
    getNatsWsUrl: () => url,
    reconnectionBackoff: { initialDelayMs: 20, maxDelayMs: 20 },
    onEvent: payload => {
      log.push(`msg:${(payload as { streamSeq: number }).streamSeq}`);
    },
  });
  useEffect(() => {
    latest = result;
  });
  useEffect(() => {
    if (result.caughtUpCount > 0) log.push(`caught-up:${result.caughtUpCount}`);
  }, [result.caughtUpCount]);
  return null;
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });
}

async function until(check: () => boolean) {
  await waitFor(() => expect(check()).toBe(true));
}

function publish(text: string) {
  return server.current.publish(SUBJECT, { type: 'TEXT', text });
}

beforeEach(() => {
  server.current = new FakeJetStream();
  log = [];
  testIndex += 1;
});

describe('useJetStreamDialogSubscription caughtUpCount', () => {
  it("does not move for a dialog's first consumer, whatever it replays", async () => {
    const seqs = [publish('a'), publish('b')];
    render(<Probe url={`ws://caught-up-${testIndex}`} optStartSeq={0} />);
    await until(() => log.length === 2);
    await wait(50);

    expect(log).toEqual(seqs.map(s => `msg:${s}`));
    expect(latest.caughtUpCount).toBe(0);
  });

  it('moves after a reconnect, once the resumed consumer has replayed what it missed', async () => {
    const seen = publish('seen');
    render(<Probe url={`ws://caught-up-${testIndex}`} optStartSeq={seen - 1} />);
    await until(() => latest.isSubscribed && log.length === 1);

    server.current.consumeDelayMs = 50;
    server.current.disconnectAll();
    await wait(5);
    const missed = [publish('missed-1'), publish('missed-2')];

    await until(() => latest.caughtUpCount === 1);
    expect(latest.reconnectionCount).toBe(1);
    expect(log).toEqual([`msg:${seen}`, ...missed.map(s => `msg:${s}`), 'caught-up:1']);
  });

  it('moves after a reconnect that missed nothing', async () => {
    const seen = publish('seen');
    render(<Probe url={`ws://caught-up-${testIndex}`} optStartSeq={seen - 1} />);
    await until(() => latest.isSubscribed && log.length === 1);

    server.current.disconnectAll();

    await until(() => latest.caughtUpCount === 1);
    expect(log).toEqual([`msg:${seen}`, 'caught-up:1']);
  });

  it('moves after a consumer recreation, once its replay is in', async () => {
    const seen = publish('seen');
    render(<Probe url={`ws://caught-up-${testIndex}`} optStartSeq={seen - 1} />);
    await until(() => latest.isSubscribed && log.length === 1);

    server.current.dropConsumers();
    const missed = [publish('missed-1'), publish('missed-2')];
    server.current.consumeDelayMs = 50;
    server.current.recreateConsumers();

    await until(() => latest.caughtUpCount === 1);
    expect(latest.reconnectionCount).toBe(1);
    expect(log).toEqual([`msg:${seen}`, ...missed.map(s => `msg:${s}`), 'caught-up:1']);
  });

  it('moves when the resumed tail cannot subscribe at all, so history is not left at its pre-gap snapshot', async () => {
    const seen = publish('seen');
    render(<Probe url={`ws://caught-up-${testIndex}`} optStartSeq={seen - 1} />);
    await until(() => latest.isSubscribed && log.length === 1);

    server.current.failConsumerLookup = true;
    server.current.disconnectAll();

    await until(() => latest.caughtUpCount === 1);
    await wait(50);
    expect(latest.caughtUpCount).toBe(1);
    // The first consumer and one failed resume; nothing retried it.
    expect(server.current.consumerLookups).toBe(2);
  });

  it('moves when the resumed consumer cannot consume: nothing more will arrive from it', async () => {
    const seen = publish('seen');
    render(<Probe url={`ws://caught-up-${testIndex}`} optStartSeq={seen - 1} />);
    await until(() => latest.isSubscribed && log.length === 1);

    server.current.failConsume = true;
    server.current.disconnectAll();
    await wait(5);
    publish('missed');

    await until(() => latest.caughtUpCount === 1);
    await wait(50);
    expect(latest.caughtUpCount).toBe(1);
    expect(server.current.createdConsumers).toHaveLength(2);
    expect(log).toEqual([`msg:${seen}`, 'caught-up:1']);
  });

  it('live-tails a null start sequence instead of replaying what the stream retains', async () => {
    publish('retained');
    render(<Probe url={`ws://caught-up-${testIndex}`} optStartSeq={null} />);
    await until(() => latest.isSubscribed);
    await wait(20);
    const live = publish('live');

    await until(() => log.length === 1);
    expect(log).toEqual([`msg:${live}`]);
    expect(server.current.createdConsumers[0]).toMatchObject({ deliver_policy: 'new' });
  });
});
