'use client';

/**
 * The ports a chat engine runs over. A host keeps only these: how its chat reaches the backend (`ChatTransport`) and how
 * it reads and keeps its dialogs (`ChatHistoryBackend`). Everything a chunk does, every rule about the thread, is the
 * engine's (`useChatEngine`).
 *
 * A transport is one of two kinds, fixed for the life of an engine:
 *
 *   - a LIVE TAIL (`ChatLiveTailTransport`): a send is published, and the answer arrives on a subscription to the
 *     dialog (the NATS WebSocket, JetStream, the Tauri bridge). OpenFrame Mingo and the Fae client.
 *   - a STREAM (`ChatStreamTransport`): a send is a request whose response IS the answer, a UI message stream (the hub's
 *     SSE chat). The server may mint the dialog on the first send and say so in the stream (`dialogIdOf`).
 *
 * The live tail is a HOOK (`useLiveTail`), because every live transport is one: the NATS WebSocket subscription, the
 * JetStream consumer, the Tauri bridge's. The engine calls it once per render; the function may be a new one each
 * render, as long as the hooks it calls are always the same.
 *
 * A replaying tail (JetStream, the Tauri bridge) delivers at least once: a chunk it already delivered can come again
 * after a reconnect. `redeliveryGate` is THE rule that drops it, by its stream sequence; every replaying tail applies
 * it before the engine sees a chunk.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatAttachment } from '../../../chat-protocol/attachment';
import type { ChatFilePart, ChatMessage, ChatToolPart } from '../../../chat-protocol/chat-message';
import type { UiChunk } from '../../../chat-protocol/ui-chunks';
import type { NatsBeforeReconnect } from '../../../nats/shared-connection';
import { useJetStreamDialogSubscription } from '../hooks/use-jetstream-dialog-subscription';
import { useNatsDialogSubscription } from '../hooks/use-nats-dialog-subscription';
import type { DialogItem, FetchChunksFunction, HistoricalMessage, NatsMessageType } from '../types';
import type {
  DialogTokenUsage,
  FetchDialogsParams,
  FetchDialogsResult,
  UnifiedSendMessageOptions,
} from '../types/unified-chat-state.types';
import type { WireCommandOverride } from '../utils/slash-dispatch-utils';

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
  /** The tail is subscribed to `dialogId`: a transport that `awaitsSubscription` publishes only after it. */
  onSubscribed?: () => void;
}

export type UseChatLiveTail = (options: ChatLiveTailOptions) => void;

/** How a chat whose answers arrive on a live tail reaches its backend. */
export interface ChatLiveTailTransport {
  kind?: 'live-tail';
  useLiveTail: UseChatLiveTail;
  /** Whether the tail replays what it missed itself. Otherwise the engine back-fills from `fetchChunks` on reconnect. */
  replays?: boolean;
  /**
   * The answer to a message comes only on the live tail, and a tail that is not subscribed yet would miss its start:
   * the engine publishes once the tail says it is subscribed to the dialog (`onSubscribed`), within 30 seconds.
   */
  awaitsSubscription?: boolean;
  /**
   * Send the user's message, with what the composer attached to it (`contextItems`, `currentPage`, …) for the host to
   * fold into its request. The answer arrives on the live tail.
   */
  publish: (
    text: string,
    options: UnifiedSendMessageOptions & { dialogId: string | null },
  ) => Promise<void | boolean> | void | boolean;
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

/** One turn a stream transport sends: a message, or the answer to an approval card. */
export type ChatStreamTurn =
  | {
      kind: 'message';
      /** The open dialog, or null: the server mints one and names it in the stream (`dialogIdOf`). */
      dialogId: string | null;
      text: string;
      /** What the composer attached, as the message's file parts. */
      files: ChatFilePart[];
      /** Narrows retrieval to one record (a card's "Discuss"). */
      commandOverride?: WireCommandOverride;
    }
  | {
      kind: 'approval';
      dialogId: string | null;
      /** The card's message: the answer continues it. */
      message: ChatMessage;
      /** The parts answered: the row named, and when it is in a batch, every row of the batch still waiting. */
      parts: ChatToolPart[];
      approved: boolean;
      reason?: string;
    };

/** The server answered a turn and refused it: nothing ran. Its words, when it gave any, are `serverMessage`. */
export class ChatTurnRefused extends Error {
  constructor(
    message: string,
    readonly serverMessage: string | null,
  ) {
    super(message);
    this.name = 'ChatTurnRefused';
  }
}

/** How a chat whose answer is the response to its request reaches its backend. */
export interface ChatStreamTransport {
  kind: 'stream';
  /**
   * Send one turn, resolving to the answer as UI message chunks. Rejects with `ChatTurnRefused` when the server refused
   * it, and with anything else when nobody knows whether it ran (a 5xx, a request that got no answer). An abort of
   * `signal` ends the stream.
   */
  openTurn: (turn: ChatStreamTurn, signal: AbortSignal) => Promise<AsyncIterable<UiChunk>>;
  /** The dialog a chunk names: the server mints the dialog on the first send and says which in the stream. */
  dialogIdOf?: (chunk: UiChunk) => string | null;
  /** The file parts a send's attachments become: the user's bubble draws them, the request carries them. */
  filePartsOf?: (attachments: readonly ChatAttachment[]) => ChatFilePart[];
  /**
   * Retrieval can be narrowed to one record: a card's "Discuss" sends a prompt that does not name the record and narrows
   * by its table (`commandOverride.entityIdFilter`). The table of a document type; null when it has none.
   */
  tableIdForDocumentType?: (documentType: string) => string | null;
}

/** How a chat reaches its backend. */
export type ChatTransport = ChatLiveTailTransport | ChatStreamTransport;

/** Page parameters of `fetchDialogMessages`. */
export interface FetchDialogMessagesParams {
  dialogId: string;
  cursor?: string;
  limit?: number;
}

/**
 * One page of persisted messages: the backend's rows (`messages`, decoded by the engine), or rows already in the
 * standard's message shape (`thread`). `tokenUsage`, when a backend answers it with the page, fills the composer's
 * readout. `missing`: the backend answered that this dialog is not one the caller can read (deleted, someone else's).
 */
export interface FetchDialogMessagesResult {
  messages?: HistoricalMessage[];
  thread?: ChatMessage[];
  nextCursor: string | null;
  tokenUsage?: DialogTokenUsage | null;
  missing?: boolean;
}

/** What a new dialog is created for: the app's name for it, the intent it opens for, the first message it will get. */
export interface ChatCreateDialogOptions {
  title?: string;
  intent?: string;
  /** The message the dialog is created to send, with what the composer attached to it. */
  firstMessage?: string;
  sendOptions?: UnifiedSendMessageOptions;
}

/** The open dialog's own record: what the list may not hold (an archived dialog, one reached by link). */
export interface ChatDialogRecord {
  dialog: DialogItem;
  tokenUsage?: DialogTokenUsage | null;
  /** Whether an answer is being written on the backend now: an IDLE record read after the composer locked releases it. */
  streamState?: 'IDLE' | 'STREAMING' | null;
}

/** How a chat reads and keeps its dialogs. Every field is a capability: absent, its affordance is hidden. */
export interface ChatHistoryBackend {
  /** The dialog list. With it the engine owns the active dialog and the list (managed mode). */
  fetchDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>;
  /** One page of a dialog's persisted messages, oldest first (`createMingoGraphqlHistory` for an OpenFrame backend). */
  fetchDialogMessages?: (params: FetchDialogMessagesParams) => Promise<FetchDialogMessagesResult>;
  /** Create a dialog. With it a send with no dialog open creates one first, and `startNewDialog` opens one. */
  createDialog?: (options: ChatCreateDialogOptions) => Promise<{ dialogId: string }>;
  /** The open dialog's record, or null when it does not resolve (the engine then says so, `dialogError`). */
  fetchDialog?: (dialogId: string) => Promise<ChatDialogRecord | null>;
  /** Compact a dialog's context on the backend (the list's "Compact" action). */
  compactDialog?: (dialogId: string) => Promise<void>;
  deleteDialog?: (dialogId: string) => Promise<void>;
  renameDialog?: (dialogId: string, title: string) => Promise<void>;
  archiveDialog?: (dialogId: string) => Promise<void>;
  fetchArchivedDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>;
  unarchiveDialog?: (dialogId: string) => Promise<void>;
}

/** A remembered open dialog, read once when the engine mounts and written on every change (the hub keeps it locally). */
export interface ChatRememberedDialog {
  load: () => string | null;
  save: (dialogId: string | null) => void;
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
  return function useNatsWsLiveTail({ enabled, dialogId, onEvent, onConnect, onSubscribed }) {
    useNatsDialogSubscription({
      enabled,
      dialogId,
      ...(topics ? { topics } : {}),
      getNatsWsUrl,
      clientConfig,
      onEvent,
      onConnect,
      ...(onSubscribed ? { onSubscribed } : {}),
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
  onBeforeReconnect,
}: ChatNatsConnection & {
  topic: NatsMessageType;
  streamName?: string;
  /** Asked before the client reconnects (a token refresh). */
  onBeforeReconnect?: NatsBeforeReconnect;
}): UseChatLiveTail {
  return function useJetStreamLiveTail({ enabled, dialogId, fromSeq, onEvent, onConnect, onResync, onSubscribed }) {
    const deliver = useRedeliveryGate(dialogId, onEvent);
    const { caughtUpCount } = useJetStreamDialogSubscription({
      enabled: enabled && fromSeq !== undefined,
      dialogId,
      topic,
      ...(streamName ? { streamName } : {}),
      optStartSeq: fromSeq ?? null,
      getNatsWsUrl,
      clientConfig,
      onEvent: deliver,
      onConnect,
      ...(onSubscribed ? { onSubscribed } : {}),
      ...(onBeforeReconnect ? { onBeforeReconnect } : {}),
    });
    useResyncOn(caughtUpCount, onResync);
  };
}

/**
 * THE redelivery gate of an at-least-once tail: a chunk whose stream sequence is not above the last one delivered for
 * the dialog was delivered already, and delivering it again would write its text or its row twice. A chunk with no
 * sequence passes. The last sequence starts over with the dialog.
 */
export function redeliveryGate(): (dialogId: string | null, payload: unknown) => boolean {
  let gatedDialog: string | null = null;
  let lastSeq = -1;
  return (dialogId, payload) => {
    if (dialogId !== gatedDialog) {
      gatedDialog = dialogId;
      lastSeq = -1;
    }
    const seq = (payload as { streamSeq?: unknown } | null)?.streamSeq;
    if (typeof seq !== 'number') return true;
    if (seq <= lastSeq) return false;
    lastSeq = seq;
    return true;
  };
}

/** `onEvent` behind the redelivery gate, for a replaying tail hook. */
export function useRedeliveryGate(
  dialogId: string | null,
  onEvent: ChatLiveTailOptions['onEvent'],
): ChatLiveTailOptions['onEvent'] {
  const [passes] = useState(redeliveryGate);
  const latest = useRef({ dialogId, onEvent });
  useEffect(() => {
    latest.current = { dialogId, onEvent };
  });
  return useCallback(
    (payload: unknown, messageType: NatsMessageType) => {
      const { dialogId: current, onEvent: deliver } = latest.current;
      if (passes(current, payload)) deliver(payload, messageType);
    },
    [passes],
  );
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
