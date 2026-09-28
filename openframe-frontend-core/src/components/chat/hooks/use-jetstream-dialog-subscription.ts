'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireClient as acquireSharedClient,
  releaseClient as releaseSharedClient,
  startConnectionLifecycle,
  type JetStreamSubscriptionHandle,
  type NatsClient,
} from '../../../nats';
import type { UseJetStreamDialogSubscriptionOptions, UseJetStreamDialogSubscriptionReturn } from '../types';

const DEFAULT_STREAM_NAME = 'CHAT_CHUNKS';
/**
 * How long the page must have been out of sight before coming back counts as an
 * absence worth resyncing for. Alt-tabbing must not churn the consumer; a
 * window that sat in the tray must not come back showing a stale conversation.
 */
export const RESYNC_AFTER_HIDDEN_MS = 10_000;
/**
 * How long resync requests are gathered before one is acted on.
 *
 * A single reveal can be reported twice: the page sees `visibilitychange`, and
 * a host that knows the window was away reports it too (`resyncSignal`),
 * neither able to tell whether the other noticed. Both land within a frame or
 * two of each other, being driven by the same OS event, and acting on both
 * rebuilds the consumer and refetches history twice for one reveal.
 *
 * Gathered on the TRAILING edge, so a request is deferred and never dropped.
 * Two reports of one reveal collapse into one rebuild; two genuinely different
 * signals — a notification reply landing just before the user opens the window
 * — also collapse into one, which is correct, because a single refetch after
 * the last of them covers both. The cost is a second of latency on a path whose
 * next step is a network round trip.
 */
const RESYNC_COALESCE_MS = 1_000;
/**
 * Floor between two reported recoveries. Every recovery costs the caller a
 * history refetch, and a consumer that cannot hold its sequence — gap, reset,
 * gap — would otherwise turn a server-side fault into a refetch storm from
 * every open client. Recoveries are a repair signal, not a data feed: one per
 * window is enough to close the gap.
 */
const RECOVERY_REPORT_FLOOR_MS = 5_000;

/**
 * Subscribe to a chat dialog stream via a JetStream **ephemeral OrderedConsumer**.
 *
 * - Subject: `chat.{dialogId}.{topic}`
 * - When `optStartSeq` is a number, the consumer resumes at `optStartSeq + 1`
 *   (`DeliverPolicy.ByStartSequence`). When null/undefined, it live-tails
 *   (`DeliverPolicy.New`).
 * - On reconnect, the consumer is recreated starting from the highest stream
 *   sequence we've already observed + 1, so no chunk is replayed or skipped.
 * - Consumer is ephemeral with `AckPolicy.None` and the client's default
 *   inactivity threshold (overridable via `inactiveThresholdMs`).
 * - `reconnectionCount` also counts consumer recreations and post-absence
 *   resyncs, not just NATS reconnects — see the counter's docs. Callers refetch
 *   persisted history whenever it moves.
 */
export function useJetStreamDialogSubscription({
  enabled,
  dialogId,
  streamName = DEFAULT_STREAM_NAME,
  topic,
  optStartSeq,
  onEvent,
  onConnect,
  onDisconnect,
  onSubscribed,
  onBeforeReconnect,
  getNatsWsUrl,
  clientConfig = {},
  reconnectionBackoff,
  inactiveThresholdMs,
  resyncSignal = 0,
}: UseJetStreamDialogSubscriptionOptions): UseJetStreamDialogSubscriptionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptionLive, setIsSubscribed] = useState(false);
  const [reconnectionCount, setReconnectionCount] = useState(0);
  // Kept apart from reconnectionCount because only the latter drives the
  // subscription effect: nats.ws has already rebuilt the consumer by the time
  // it reports a recovery, so tearing ours down and recreating it would be
  // churn — and churn that can feed itself, since each new consumer can report
  // its own recoveries. Callers see the two summed (see the return).
  const [recoveryCount, setRecoveryCount] = useState(0);
  // The highest sequence seen, TAGGED with the dialog it belongs to. The tag is
  // what makes the per-dialog reset implicit — a sequence from another
  // conversation simply stops matching — so the dialog-change effect below no
  // longer has to publish `null` from its body. It also closes the window that
  // reset relied on being empty: a straggling message from the previous
  // dialog's consumer now carries that dialog's id and cannot be read as this
  // one's offset.
  const [seqEntry, setSeqEntry] = useState<{ dialogId: string | null | undefined; seq: number } | null>(null);
  const currentStreamSeq = seqEntry && seqEntry.dialogId === dialogId ? seqEntry.seq : null;

  // `subscriptionLive` only says "the async subscribe call resolved". Whether a
  // subscription can exist AT ALL is a fact about the inputs, and masking with
  // it here is what lets the subscription effect drop its `setIsSubscribed(false)`
  // early-return branch — a synchronous setState in an effect body that ran on
  // every disconnect and every dialog change.
  const isSubscribed = subscriptionLive && enabled && Boolean(dialogId) && isConnected;

  const lastRecoveryReportRef = useRef(0);
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResyncSignalRef = useRef(resyncSignal);
  // Latest `resyncSignal` for the dialog-change effect, which re-baselines on
  // it but must NOT re-run when it moves — that is the resync effect's job.
  const resyncSignalRef = useRef(resyncSignal);
  useEffect(() => {
    resyncSignalRef.current = resyncSignal;
  });
  const clientRef = useRef<NatsClient | null>(null);
  const subscriptionRef = useRef<JetStreamSubscriptionHandle | null>(null);
  const highestStreamSeqRef = useRef<number | null>(null);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const onConnectRef = useRef(onConnect);
  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  const onDisconnectRef = useRef(onDisconnect);
  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  const onSubscribedRef = useRef(onSubscribed);
  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
  }, [onSubscribed]);

  const onBeforeReconnectRef = useRef(onBeforeReconnect);
  useEffect(() => {
    onBeforeReconnectRef.current = onBeforeReconnect;
  }, [onBeforeReconnect]);

  const getNatsWsUrlRef = useRef(getNatsWsUrl);
  useEffect(() => {
    getNatsWsUrlRef.current = getNatsWsUrl;
  }, [getNatsWsUrl]);

  const reconnectionBackoffRef = useRef(reconnectionBackoff);
  useEffect(() => {
    reconnectionBackoffRef.current = reconnectionBackoff;
  }, [reconnectionBackoff]);

  const optStartSeqRef = useRef<number | null | undefined>(optStartSeq);
  useEffect(() => {
    optStartSeqRef.current = optStartSeq;
  }, [optStartSeq]);

  const inactiveThresholdRef = useRef<number | undefined>(inactiveThresholdMs);
  useEffect(() => {
    inactiveThresholdRef.current = inactiveThresholdMs;
  }, [inactiveThresholdMs]);

  const hadConnectionBeforeRef = useRef(false);

  const clientConfigRef = useRef(clientConfig);
  useEffect(() => {
    clientConfigRef.current = clientConfig;
  }, [clientConfig]);

  const currentWsUrlRef = useRef<string>('');

  // Resolve the URL synchronously each render so the effect depends on the URL string
  // itself, not the (often inline-allocated) getNatsWsUrl callback identity. Otherwise
  // every silent token rotation that rebuilds getNatsWsUrl in the caller would tear
  // the WS down and reacquire even though the resolved URL hasn't changed.
  const wsUrl = getNatsWsUrl();

  useEffect(() => {
    if (!enabled || !wsUrl) {
      if (currentWsUrlRef.current && clientRef.current) {
        releaseSharedClient(currentWsUrlRef.current);
        clientRef.current = null;
        currentWsUrlRef.current = '';
        setIsConnected(false);
      }
      return undefined;
    }

    if (wsUrl === currentWsUrlRef.current && clientRef.current && clientRef.current.isConnected()) {
      return undefined;
    }

    if (currentWsUrlRef.current && currentWsUrlRef.current !== wsUrl && clientRef.current) {
      releaseSharedClient(currentWsUrlRef.current);
      clientRef.current = null;
      setIsConnected(false);
    }

    currentWsUrlRef.current = wsUrl;
    const cfg = clientConfigRef.current;
    const sharedConn = acquireSharedClient(wsUrl, {
      name: cfg.name ?? 'openframe-frontend-jetstream',
      user: cfg.user ?? 'machine',
      pass: cfg.pass ?? '',
    });
    const client = sharedConn.client;

    clientRef.current = client;
    setIsConnected(client.isConnected());

    const tearDownSubscription = () => {
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch {
          // ignore
        }
        subscriptionRef.current = null;
      }
    };

    const lifecycle = startConnectionLifecycle({
      conn: sharedConn,
      wsUrl,
      onBeforeReconnect: () => onBeforeReconnectRef.current?.(),
      backoff: reconnectionBackoffRef.current,
      getFreshUrl: () => getNatsWsUrlRef.current(),
      // JetStream emits 'error' for protocol-level failures (e.g. -ERR Permissions
      // Violation when CONSUMER.CREATE is denied) without closing the WebSocket.
      // Retrying on 'error' would loop onBeforeReconnect on every -ERR; let the
      // subscribe effect surface those via its own rejected promise instead.
      shouldRetryOn: status => status === 'closed' || status === 'disconnected',
      onStatusChange: (status, evt) => {
        if (status === 'connected') {
          setIsConnected(true);
          if (hadConnectionBeforeRef.current) {
            setReconnectionCount(c => c + 1);
          }
          hadConnectionBeforeRef.current = true;
          onConnectRef.current?.();
        }
        if (status === 'error') {
          console.warn('[JetStream] NATS protocol error:', evt.data);
          return;
        }
        if (status === 'closed' || status === 'disconnected') {
          setIsConnected(false);
          setIsSubscribed(false);
          tearDownSubscription();
          onDisconnectRef.current?.();
        }
      },
    });

    return () => {
      lifecycle.stop();
      setIsConnected(false);
      setIsSubscribed(false);
      tearDownSubscription();

      if (clientRef.current && currentWsUrlRef.current) {
        releaseSharedClient(currentWsUrlRef.current);
        clientRef.current = null;
        currentWsUrlRef.current = '';
      }
    };
  }, [enabled, wsUrl]);

  // Reset the highest-seen sequence whenever the dialog changes so a new dialog
  // starts from optStartSeq (or DeliverPolicy.New) rather than the previous
  // dialog's offset. MUST be declared BEFORE the subscription effect below:
  // React runs effects in declaration order, and when this ran after it, the
  // new dialog's consumer was created with the PREVIOUS dialog's stale
  // `highestStreamSeq + 1` as its start sequence (skipping messages /
  // ignoring optStartSeq).
  useEffect(() => {
    highestStreamSeqRef.current = null;
    // A host's signal counts per dialog (it can carry a per-conversation term),
    // so the baseline has to move with the dialog or a switch to one with a
    // LOWER count would swallow every later resync for it.
    lastResyncSignalRef.current = resyncSignalRef.current;
    // (The published sequence resets itself — it is tagged with its dialog id
    // where it is declared above.)
    // A resync gathered for the previous dialog must not land on this one: the
    // counter says nothing about which conversation it meant, so callers would
    // refetch the wrong one. The dialog change supersedes it — the new dialog
    // loads its own history regardless. As cleanup, so it covers unmount too,
    // which is the same rule.
    return () => {
      if (resyncTimerRef.current !== null) {
        clearTimeout(resyncTimerRef.current);
        resyncTimerRef.current = null;
      }
    };
    // `resyncSignal` is read as the new baseline, not depended on: reacting to
    // it here would reset the baseline on the very change meant to trigger a
    // resync, and the effect below owns that.
  }, [dialogId]);

  // Coming back into view after a real absence is treated exactly like a
  // reconnect, because the page cannot tell the difference from the inside.
  // While it was hidden — a tray-hidden desktop window, a background tab, a
  // sleeping machine — delivery may have stopped without the socket ever
  // closing and without any consumer event to show for it. Nothing else will
  // report that: the tail simply stays quiet, and the conversation on screen
  // stays frozen at whatever was there when the window went away (the user's
  // manual fix is a page refresh, which is exactly the history refetch this
  // triggers). Rebuilds the consumer from the last sequence seen AND tells
  // callers to refetch history.
  //
  // Every source funnels through here (see `RESYNC_COALESCE_MS`). Restarting
  // the timer rather than dropping is what makes that safe: a request is only
  // ever folded into the one that follows it, never discarded.
  const requestResync = useCallback(() => {
    if (resyncTimerRef.current !== null) clearTimeout(resyncTimerRef.current);
    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      setReconnectionCount(c => c + 1);
    }, RESYNC_COALESCE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let hiddenSince = document.visibilityState === 'hidden' ? Date.now() : 0;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now();
        return;
      }
      const awayMs = hiddenSince === 0 ? 0 : Date.now() - hiddenSince;
      hiddenSince = 0;
      if (awayMs >= RESYNC_AFTER_HIDDEN_MS) {
        requestResync();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [enabled, requestResync]);

  useEffect(() => {
    // Held, not consumed, while disabled: it fires once on enable instead.
    // A host reports a signal against the conversation, not against this hook's
    // readiness, so one arriving while the caller is still assembling the
    // subscription describes a gap in the history the caller is fetching right
    // now. Dropping it would leave that fetch's result stale with nothing left
    // to say so.
    if (!enabled) return;
    // The mount value is a baseline, not a signal.
    if (resyncSignal <= lastResyncSignalRef.current) return;
    lastResyncSignalRef.current = resyncSignal;
    requestResync();
  }, [enabled, resyncSignal, requestResync]);

  // Subscription lifecycle: (re)create the ephemeral JetStream consumer whenever
  // we transition into a connected state for a dialog, and whenever the dialog
  // changes. On reconnect we resume from highestStreamSeq + 1.
  useEffect(() => {
    if (!enabled || !dialogId || !isConnected) {
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch {
          // ignore
        }
        subscriptionRef.current = null;
      }
      // No `setIsSubscribed(false)` here: `isSubscribed` already masks on
      // exactly these three inputs (see its declaration).
      return undefined;
    }

    const client = clientRef.current;
    if (!client) return undefined;

    const abortController = new AbortController();
    const decoder = new TextDecoder();
    const filterSubject = `chat.${dialogId}.${topic}`;

    const resumeSeq = highestStreamSeqRef.current;
    const initialOptStart = optStartSeqRef.current;
    const startSeq = resumeSeq != null ? resumeSeq + 1 : initialOptStart != null ? initialOptStart + 1 : undefined;

    let cancelled = false;

    void (async () => {
      try {
        const handle = await client.subscribeJetStreamOrdered(
          msg => {
            if (cancelled) return;
            const streamSeq = msg.info.streamSequence;
            if (typeof streamSeq === 'number') {
              if (highestStreamSeqRef.current == null || streamSeq > highestStreamSeqRef.current) {
                highestStreamSeqRef.current = streamSeq;
                // Tagged with the dialog this consumer was created for, so a
                // message that arrives after a dialog switch cannot be read as
                // the new conversation's offset.
                setSeqEntry({ dialogId, seq: streamSeq });
              }
            }
            const cb = onEventRef.current;
            if (!cb) return;
            try {
              const parsed = JSON.parse(decoder.decode(msg.data)) as Record<string, unknown>;
              if (typeof streamSeq === 'number') {
                (parsed as { streamSeq?: number }).streamSeq = streamSeq;
              }
              cb(parsed, topic);
            } catch {
              // Ignore malformed payloads.
            }
          },
          {
            streamName,
            filterSubject,
            deliverPolicy: startSeq != null ? 'byStartSequence' : 'new',
            optStartSeq: startSeq,
            // Undefined when the caller did not set one: the client owns the default,
            // so it is not spelled out a second time here.
            inactiveThresholdMs: inactiveThresholdRef.current,
            signal: abortController.signal,
            onRecovered: () => {
              if (cancelled) return;
              const now = Date.now();
              if (now - lastRecoveryReportRef.current < RECOVERY_REPORT_FLOOR_MS) return;
              lastRecoveryReportRef.current = now;
              setRecoveryCount(c => c + 1);
            },
          },
        );

        if (cancelled) {
          try {
            handle.unsubscribe();
          } catch {
            // ignore
          }
          return;
        }

        subscriptionRef.current = handle;
        setIsSubscribed(true);
        onSubscribedRef.current?.();
      } catch {
        if (!cancelled) {
          setIsSubscribed(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch {
          // ignore
        }
        subscriptionRef.current = null;
      }
      setIsSubscribed(false);
    };
  }, [enabled, dialogId, isConnected, streamName, topic, reconnectionCount]);

  // One counter for every way the tail comes back — reconnect, consumer
  // recreation, post-absence resync — because callers do the same thing for all
  // of them: refetch persisted history, since the gap may predate what the
  // stream still holds. The last two are the quiet ones; no connection event
  // fires for either.
  return {
    isConnected,
    isSubscribed,
    reconnectionCount: reconnectionCount + recoveryCount,
    currentStreamSeq,
  };
}
