'use client';

/**
 * The ports a chat engine runs over. A host keeps only these: how its chat reaches the backend (`ChatTransport`) and how
 * it reads and keeps its dialogs (`ChatHistoryBackend`). Everything a chunk does, every rule about the thread, is the
 * engine's (`useChatEngine`).
 *
 * The live tail is a HOOK (`useLiveTail`), because every live transport is one: the NATS WebSocket subscription, the
 * JetStream consumer, the Tauri bridge's. The engine calls it once per render; the function may be a new one each
 * render, as long as the hooks it calls are always the same.
 */

import { useEffect, useRef } from 'react';
import { useJetStreamDialogSubscription } from '../hooks/use-jetstream-dialog-subscription';
import { useNatsDialogSubscription } from '../hooks/use-nats-dialog-subscription';
import type { FetchChunksFunction, HistoricalMessage, NatsMessageType } from '../types';
import type {
  DialogTokenUsage,
  FetchDialogsParams,
  FetchDialogsResult,
  UnifiedSendMessageOptions,
} from '../types/unified-chat-state.types';

/** What the engine asks of a live tail. */
export interface ChatLiveTailOptions {
  enabled: boolean;
  dialogId: string | null;
  /**
   * The highest stream sequence the dialog's history holds once it is read (null: it holds none), undefined while it
   * has not been read. A tail that replays (JetStream, the Tauri bridge) starts right after it; one that does not ignores it.
   */
  fromSeq: number | null | undefined;
  /** One raw chunk, with the subject topic it came on (the back-fill dedupes per topic). */
  onEvent: (payload: unknown, messageType: NatsMessageType) => void;
  /** The tail (re)connected. A tail that does not replay owes the chat a back-fill of the gap, which the engine runs. */
  onConnect: () => void;
  /** A replaying tail came back after a gap and delivered what the stream held: the engine refetches history. */
  onResync: () => void;
}

export type UseChatLiveTail = (options: ChatLiveTailOptions) => void;

/** How a chat reaches its backend. */
export interface ChatTransport {
  useLiveTail: UseChatLiveTail;
  /** Whether the tail replays what it missed itself. Otherwise the engine back-fills from `fetchChunks` on reconnect. */
  replays?: boolean;
  /**
   * Send the user's message, with what the composer attached to it (`contextItems`, `currentPage`, …) for the host to
   * fold into its request. The answer arrives on the live tail.
   */
  publish: (text: string, options: UnifiedSendMessageOptions & { dialogId: string | null }) => Promise<void> | void;
  /** The chunk back-fill a tail that does not replay is read with (see `useChunkCatchup`). */
  fetchChunks?: FetchChunksFunction;
  /** Cancel the running answer on the backend. Without it, Stop only unlocks the composer. */
  stop?: (dialogId: string) => Promise<void>;
  /** Answer an approval card, by the id the backend knows it by. Without them, a card's buttons are disabled. */
  approve?: (requestId: string) => Promise<void>;
  reject?: (requestId: string, reason?: string) => Promise<void>;
  /** Answer an escalation offer (it resolves through the ticket's mutations, not the approval endpoint). */
  approveEscalation?: (offerId: string) => void | Promise<void>;
  rejectEscalation?: (offerId: string) => void | Promise<void>;
}

/** Page parameters of `fetchDialogMessages`. */
export interface FetchDialogMessagesParams {
  dialogId: string;
  cursor?: string;
  limit?: number;
}

/** One page of persisted messages. `tokenUsage`, when a backend answers it with the page, fills the composer's readout. */
export interface FetchDialogMessagesResult {
  messages: HistoricalMessage[];
  nextCursor: string | null;
  tokenUsage?: DialogTokenUsage | null;
}

/** How a chat reads and keeps its dialogs. Every field is a capability: absent, its affordance is hidden. */
export interface ChatHistoryBackend {
  /** The dialog list. With it the engine owns the active dialog and the list (managed mode). */
  fetchDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>;
  /** One page of a dialog's persisted messages, oldest first (`createMingoGraphqlHistory` for an OpenFrame backend). */
  fetchDialogMessages?: (params: FetchDialogMessagesParams) => Promise<FetchDialogMessagesResult>;
  createDialog?: () => Promise<{ dialogId: string }>;
  deleteDialog?: (dialogId: string) => Promise<void>;
  renameDialog?: (dialogId: string, title: string) => Promise<void>;
  archiveDialog?: (dialogId: string) => Promise<void>;
  fetchArchivedDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>;
  unarchiveDialog?: (dialogId: string) => Promise<void>;
}

/** The NATS client a tail connects with. */
export interface ChatNatsConnection {
  getNatsWsUrl: () => string | null;
  clientConfig?: { name?: string; user?: string; pass?: string };
}

/**
 * The plain NATS WebSocket tail: it replays nothing, so the engine back-fills a gap from `fetchChunks`. `topics` are the
 * subject suffixes (`chat.<dialogId>.<topic>`): the end user's chat publishes on `message`, Mingo on `admin-message`.
 */
export function natsWsLiveTail({
  getNatsWsUrl,
  clientConfig,
  topics,
}: ChatNatsConnection & { topics?: NatsMessageType[] }): UseChatLiveTail {
  return function useNatsWsLiveTail({ enabled, dialogId, onEvent, onConnect }) {
    useNatsDialogSubscription({
      enabled,
      dialogId,
      ...(topics ? { topics } : {}),
      getNatsWsUrl,
      clientConfig,
      onEvent,
      onConnect,
    });
  };
}

/**
 * The JetStream tail: a consumer that starts right after the history's last sequence and replays a gap itself, so it
 * opens only once the history has been read (`fromSeq` known). After a gap it reports when it has caught up, which is
 * when the history is refetched. Pair it with `replays: true`.
 */
export function jetStreamLiveTail({
  getNatsWsUrl,
  clientConfig,
  topic,
  streamName,
}: ChatNatsConnection & { topic: NatsMessageType; streamName?: string }): UseChatLiveTail {
  return function useJetStreamLiveTail({ enabled, dialogId, fromSeq, onEvent, onConnect, onResync }) {
    const { caughtUpCount } = useJetStreamDialogSubscription({
      enabled: enabled && fromSeq !== undefined,
      dialogId,
      topic,
      ...(streamName ? { streamName } : {}),
      optStartSeq: fromSeq ?? null,
      getNatsWsUrl,
      clientConfig,
      onEvent,
      onConnect,
    });
    useResyncOn(caughtUpCount, onResync);
  };
}

/** Calls `onResync` each time `count` moves on from the value it had when the tail opened. */
function useResyncOn(count: number, onResync: () => void): void {
  const seen = useRef(count);
  const latest = useRef(onResync);
  useEffect(() => {
    latest.current = onResync;
  });
  useEffect(() => {
    if (count === seen.current) return;
    seen.current = count;
    latest.current();
  }, [count]);
}
