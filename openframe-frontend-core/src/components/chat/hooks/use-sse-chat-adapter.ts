'use client';

/**
 * useSseChatAdapter: the SSE/Guide-mode transport adapter for the unified chat surface. One of two `UnifiedChatState`
 * implementations; its NATS counterpart is `useNatsChatAdapter` (Mingo mode). The public `useUnifiedChat` dispatches
 * between them based on the mode's `transport`.
 *
 * The adapter owns no parser and no message merge. Raw response bytes flow
 *
 *   fetch body → createChatStreamReader → UiChunk → createChatStreamReducer, THE master reader
 *
 * and this file keeps only the transport wiring (fetch/abort, request bodies), the server-issued conversation-id
 * persistence (id ONLY, see below), the mount-time server-history hydration seam, and the public `UnifiedChatState` mapping.
 *
 * Conversation identity + history (server SSOT):
 *
 *   - Conversation ids are SERVER-minted. The first send of a session goes out with a client id the server does not know,
 *     so it mints one and echoes it in `metadata.conversationId`, and every later turn sends it back as the request's `id`.
 *   - localStorage stores ONLY that echoed id (`chat-conversation-storage`). Message history lives server-side in
 *     `chat_conversations` / `chat_messages` and is rebuilt on mount via `useChatHistoryHydration`, which materializes
 *     through the reducer (`initializeWithState` / `prependMessages`).
 *   - The wire carries ONLY the newest user message, never a replay of the client-side thread (the server re-reads
 *     `chat_messages` by conversation id on every turn).
 *
 * An approval is the standard's round trip on the same endpoint: the card's message goes back holding the answered parts,
 * and the response continues that message (the receipt, the card of what it did, the auto-continuation).
 *
 * Two key contracts vs hub-side chat hooks:
 *
 *   1. `source` is READ FROM THE RUNTIME, not a parameter. It is OPTIONAL: platform-agnostic embedders leave it unset; an
 *      empty `source` falls back to a stable constant (`DEFAULT_CHAT_SOURCE`) for the localStorage conversation-id
 *      namespace. It is NEVER sent on the wire (the hub resolves source server-side via `currentPlatform()`).
 *
 *   2. `tableIdForDocumentType` is INJECTED via the optional `tableIdForDocumentType` parameter. Hub callers pass the
 *      registry-backed lookup from `lib/config/rag-table-config`; embedders that don't supply one fall back to
 *      `defaultTableIdForDocumentType` so the `displayRef` / `discussRef` Ask + Display buttons WORK out of the box.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  approvalStatusOf,
  isToolPart,
  type ChatFilePart,
  type ChatMessage,
  type ChatMessageMetadata,
  type ChatToolPart,
} from '../../../chat-protocol/chat-message';
import { buildConfirmToolBody, readServerErrorMessage } from '../../../chat-protocol/confirm-tool';
import { createChatStreamReader, type ChatStreamWire } from '../../../chat-protocol/message-decoder';
import type { UiChunk } from '../../../chat-protocol/ui-chunks';
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context';
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch';
import { defaultTableIdForDocumentType } from '../../../utils/source-icons';
import type { ChatRef } from '../chat-ref.types';
import { CHAT_HISTORY_PAGE_SIZE } from '../mingo-chat-history';
import { createChatDialogStore } from '../stream/chat-dialog-store';
import type { ChatDialogStore } from '../stream/chat-dialog-store';
import { useChatStreamReducer } from '../stream/use-chat-stream-reducer';
import type { SlashCommandSummary } from '../types/component.types';
import type { ChatMessageActions } from '../types/message.types';
import type {
  ChatDialogCapabilities,
  FetchDialogsParams,
  UnifiedChatState,
  UnifiedSendMessageOptions,
  UnifiedUsageBreakdown,
} from '../types/unified-chat-state.types';
import {
  buildChatAttachmentViewUrl,
  formatChatAttachmentMarkdownForBubble,
  type ChatAttachment,
} from '../utils/chat-attachment-markdown';
import { createChatConversationStorage, pruneStaleChatConversationStorage } from '../utils/chat-conversation-storage';
import { createChatConversationsApi } from '../utils/chat-conversations-api';
import { buildDiscussPrompt } from '../utils/discuss-ref-prompt';
import { sanitizeTitleForChat } from '../utils/slash-dispatch-utils';
import type { WireCommandOverride } from '../utils/slash-dispatch-utils';
import { useChatHistoryHydration } from './use-chat-history-hydration';
import { useManagedDialogList } from './use-managed-dialog-list';
import { useSlashCommandRegistry } from './use-slash-commands';

// ─── Stable no-op references for the capabilities Guide mode never has ──
// Plain module-scope constants so the adapter's return identity stays stable
// across renders: consumers that memo on these fields don't get spurious
// re-runs. The dialog LIST itself is no longer stubbed here: without a
// conversations endpoint the shared `useManagedDialogList` is inert by
// construction (empty list, false flags, memoized no-op mutations).
const noopSelectDialog = (_id: string | null): void => {
  /* No conversations endpoint configured: nothing to select */
};
/** "New chat" is `clearMessages` (the server mints an id on the next send);
 *  there is no create call to make. */
const noopStartNewDialog = (): Promise<string | null> => Promise.resolve(null);
const noopDeleteDialog = async (_id: string): Promise<void> => {
  /* Deletion is not offered: archive replaces it. */
};
const noopAsync = async (): Promise<void> => {
  /* no-op pagination stub (message history, which Guide does not page) */
};

// =============================================================================
// Public types
// =============================================================================

/** Source identifier: opaque string ID (registry lookup happens in the
 *  hub-side platform-utils, not in lib). */
export type DocSource = string;

/**
 * Optional dependency-injection options for `useSseChatAdapter`.
 *
 *   - `tableIdForDocumentType`: looks up the RagTableConfig.id for an
 *     LLM document type. Used by `displayRef` + `discussRef` to translate
 *     an inline-card click into a server-side entity-id filter.
 *
 *     **Defaults to `defaultTableIdForDocumentType` from
 *     `src/utils/source-icons.ts`**: a lib-baked map covering every
 *     documentType currently registered in the hub's RAG_TABLE_CONFIGS.
 *     Override only for polymorphic / per-tenant document types.
 */
export interface UseSseChatAdapterOptions {
  tableIdForDocumentType?: (documentType: string) => string | null;
}

export interface UseSseChatAdapterRuntimeOptions {
  /**
   * When `false` the adapter skips its background slash-command registry
   * fetch (used to hydrate the `displayRef` table lookup) AND the
   * mount-time server-history hydration. Mirrors the NATS adapter's
   * `active` gate: `useUnifiedChat` passes `false` while Guide mode is
   * configured-but-not-active, so opening the panel in Mingo mode does
   * NOT hit the commands or history endpoints. Default `true` so
   * standalone callers keep the eager prefetch.
   */
  active?: boolean;
}

// =============================================================================
// Local persistence: the server-issued conversation id ONLY
// =============================================================================
//
// The ONLY thing persisted locally is the conversation id the SERVER minted and echoed in the stream of the session's first
// turn. Message history lives server-side in `chat_conversations` / `chat_messages` (recorded turn-by-turn by the chat
// route) and is rehydrated on mount via `GET <chatStreamUrl>/history`. localStorage never stores messages or sources: the
// server transcript is the single source of truth for history. (The retired PersistedChatState v1 full-history blobs are
// swept on mount by `pruneStaleChatConversationStorage`: never read, never migrated.)

/** localStorage namespace used when no `source` is configured on the
 *  runtime. Embedders are platform-agnostic (see `ChatRuntime.source`), so any
 *  stable string works here: the hub passes its real platform instead. */
const DEFAULT_CHAT_SOURCE = 'embed';

// Persistence itself lives in `../utils/chat-conversation-storage.ts` (built
// on the lib-standard `createLocalStorageAdapter`); the mount-time history
// rebuild lives in `./use-chat-history-hydration.ts`.

// =============================================================================
// Reading a turn's metadata
// =============================================================================

function isWireRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The `breakdown` on the `finish` chunk's usage is an OPAQUE wire blob; these readers hand back values that match
 *  `UnifiedUsageBreakdown`. */
function readTokenPair(value: unknown): { input: number; output: number } | undefined {
  if (!isWireRecord(value) || typeof value.input !== 'number') return undefined;
  // A pair that omitted `output` must not put `undefined` into a `number` field and NaN any downstream sum.
  return { input: value.input, output: typeof value.output === 'number' ? value.output : 0 };
}

function readRoutedAnswer(value: unknown): { model: string; complexity: string; thinkingBudget: number } | undefined {
  if (!isWireRecord(value) || typeof value.model !== 'string') return undefined;
  return {
    model: value.model,
    complexity: typeof value.complexity === 'string' ? value.complexity : '',
    thinkingBudget: typeof value.thinkingBudget === 'number' ? value.thinkingBudget : 0,
  };
}

function usageBreakdownOf(raw: unknown): UnifiedUsageBreakdown | null {
  if (!isWireRecord(raw)) return null;
  return {
    haikuRewriter: readTokenPair(raw.haikuRewriter),
    haikuClassifier: readTokenPair(raw.haikuClassifier),
    haikuSummarizer: readTokenPair(raw.haikuSummarizer),
    routedAnswer: readRoutedAnswer(raw.routedAnswer),
  };
}

/** The newest answer that has reported usage: the live turn's, or until it reports, the one before it. */
function latestUsageOf(messages: readonly ChatMessage[]): NonNullable<ChatMessageMetadata['usage']> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const usage = messages[i].metadata?.usage;
    if (messages[i].role === 'assistant' && usage) return usage;
  }
  return null;
}

/** The conversation id a chunk carries. */
function conversationIdOfChunk(chunk: UiChunk): string | null {
  if (chunk.type !== 'message-metadata' && chunk.type !== 'start' && chunk.type !== 'finish') return null;
  const id = chunk.messageMetadata?.conversationId;
  return typeof id === 'string' && id !== '' ? id : null;
}

// =============================================================================
// Requests
// =============================================================================

/** A client id the server does not know: it means a new conversation (the standard's `id` is always there). */
function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** An attachment as the part it rides in. Its url is the view proxy, through the host's own prefix. */
function filePartOfAttachment(attachment: ChatAttachment, viewUrlPrefix: string): ChatFilePart {
  return {
    type: 'file',
    mediaType: attachment.contentType,
    filename: attachment.fileName,
    url: buildChatAttachmentViewUrl(viewUrlPrefix, attachment.storagePath, attachment.viewToken),
  };
}

/** The parts of one approval: the row it names, and when that row is in a batch, the whole batch. Only what still waits. */
function pendingApprovalParts(message: ChatMessage, id: string): ChatToolPart[] {
  const tools = message.parts.filter(isToolPart);
  const named = tools.find(part => 'approval' in part && part.approval?.id === id);
  const batchId = (named && 'approval' in named ? named.approval?.descriptor?.batchId : undefined) ?? id;
  return tools.filter(
    part =>
      approvalStatusOf(part) === 'pending' &&
      'approval' in part &&
      (part.approval?.id === id || part.approval?.descriptor?.batchId === batchId),
  );
}

/** The asked-for parts no answer reached: they still read as answered and waiting on their tool. */
function unansweredParts(messages: readonly ChatMessage[], asked: readonly ChatToolPart[]): ChatToolPart[] {
  const held = new Map(messages.flatMap(message => message.parts.filter(isToolPart)).map(p => [p.toolCallId, p]));
  return asked.filter(part => held.get(part.toolCallId)?.state === 'approval-responded');
}

/** What a row says when nothing said how its approval ended: a stream that was cut or stopped. It may have run. */
export const APPROVAL_OUTCOME_UNKNOWN =
  'The answer stopped before saying how this ended, so it may or may not have gone through. Check before trying again.';

/** What a row says when the server refused with no words of its own, a gateway's page say. */
export const APPROVAL_REFUSED = 'The server refused this, so it did not run.';

/** The server answered and refused: nothing ran. A 5xx is none: it may be a gateway's word about a write still running. */
class RequestRefused extends Error {
  constructor(
    message: string,
    readonly serverMessage: string | null,
  ) {
    super(message);
  }
}

/** The newest message holding a pending approval this id names. */
function cardOfApproval(
  messages: readonly ChatMessage[],
  id: string,
): { message: ChatMessage; parts: ChatToolPart[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = pendingApprovalParts(messages[i], id);
    if (parts.length > 0) return { message: messages[i], parts };
  }
  return null;
}

// =============================================================================
// useSseChatAdapter: public hook
// =============================================================================

/**
 * Stream-driven AI chat hook. Returns the message list, send/stop/clear
 * controls, and per-turn metadata (model name, token counts, routing
 * decision) the lib's `<ChatContainer>` consumes.
 *
 * Source identity comes from `useRequiredChatRuntime().source`: no
 * parameter. An empty `source` falls back to `DEFAULT_CHAT_SOURCE` (used only
 * for the conversation-id localStorage namespace; never sent on the wire).
 */
export function useSseChatAdapter(
  options?: UseSseChatAdapterOptions,
  runtimeOptions: UseSseChatAdapterRuntimeOptions = {},
): UnifiedChatState {
  const { active = true } = runtimeOptions;
  // Chat-specific code REQUIRES a runtime: the lib's `<HubRuntimeProvider>`
  // (hub) / embedder's provider must wrap the tree.
  const runtime = useRequiredChatRuntime();
  const source = runtime.source || DEFAULT_CHAT_SOURCE;
  const tableIdForDocumentType = options?.tableIdForDocumentType ?? defaultTableIdForDocumentType;

  // ─── Reducer wiring ────────────────────────────────────────────────────────
  // One store per hook instance; one reducer keyed by the source.

  const storeRef = useRef<ChatDialogStore | null>(null);
  if (storeRef.current === null) storeRef.current = createChatDialogStore();

  const { state, applyEntry, flushDeltas, mutate } = useChatStreamReducer({
    store: storeRef.current,
    dialogId: source,
  });

  // ─── Conversation identity: server-minted id, restored once on mount ─────
  // Null = no conversation yet: the FIRST send goes out with a client id, the
  // server mints one, and the metadata capture (in the stream loop below)
  // stores it. The client's id never names a conversation. This is the ONLY local
  // persistence — message history hydrates from the server transcript below.
  const conversationStorage = useMemo(() => createChatConversationStorage(source), [source]);
  const conversationIdRef = useRef<string | null>(null);
  const restoredConversationRef = useRef(false);
  if (!restoredConversationRef.current) {
    restoredConversationRef.current = true;
    // Sweeps other-identity keys AND the retired v1 full-history blobs.
    pruneStaleChatConversationStorage(source);
    conversationIdRef.current = conversationStorage.load()?.conversationId ?? null;
  }
  // Render-visible mirror of the ref. The ref stays the SYNCHRONOUS send-time
  // source (a capture mid-stream must be visible to the very next send); the
  // state is what re-arms history hydration and drives `activeDialogId` when
  // the user switches conversations. ONE writer for both + storage.
  const [conversationId, setConversationId] = useState<string | null>(() => conversationIdRef.current);
  const commitConversationId = useCallback(
    (id: string | null) => {
      conversationIdRef.current = id;
      setConversationId(id);
      if (id) conversationStorage.save({ conversationId: id });
      else conversationStorage.clear();
    },
    [conversationStorage],
  );

  // ─── Slash-command registry (displayRef lookup) ───────────────────────────
  // Reads from the SAME react-query cache entry as `<EmbeddableChat>`'s
  // onboarding-card list (keyed on `commandsUrl`), so Guide mode fetches
  // `commands` ONCE. Gated on `active` so a Mingo-only panel, where this
  // adapter is mounted but idle, never hits the endpoint.
  const commandsUrl = runtime.endpoints.commandsUrl;
  const { commands: slashCommands } = useSlashCommandRegistry(commandsUrl, {
    enabled: active,
  });
  const cmdIdByTableId = useMemo(() => {
    const buckets = new Map<string, SlashCommandSummary[]>();
    for (const cmd of slashCommands) {
      if (!cmd.primarySourceId) continue;
      const arr = buckets.get(cmd.primarySourceId) ?? [];
      arr.push(cmd);
      buckets.set(cmd.primarySourceId, arr);
    }
    const map = new Map<string, string>();
    for (const [tableId, cmds] of buckets) {
      const display = cmds.find(c => c.actions.some(a => a.id === 'display'));
      const picked =
        display ??
        [...cmds].sort((a, b) => {
          const ao = a.displayOrder ?? Number.POSITIVE_INFINITY;
          const bo = b.displayOrder ?? Number.POSITIVE_INFINITY;
          return ao - bo;
        })[0];
      if (picked) map.set(tableId, picked.id);
    }
    return map;
  }, [slashCommands]);

  // ─── Server hydration (history SSOT) ──────────────────────────────────────
  // Mount-time rebuild of the message list from the server transcript, the single store of conversation history. The
  // fetch/guard/decode lives in `use-chat-history-hydration.ts` (see there for the full contract + failure semantics: a miss
  // starts the UI empty, never loses server context). THIS adapter owns the materialization seam: `hydrateMessages` feeds it
  // through the REDUCER: `initializeWithState` on an empty thread, `prependMessages` when the user already sent before
  // hydration landed (nothing typed is lost; the server resolves LLM history from its own store either way). No parallel
  // merge path.
  const historyUrl =
    runtime.endpoints.chatHistoryUrl ?? `${runtime.endpoints.chatStreamUrl.replace(/\/+$/, '')}/history`;
  const hydrateMessages = useCallback(
    (history: ChatMessage[]) => {
      mutate(r => {
        if (r.state.messages.length === 0) {
          r.initializeWithState(history);
        } else {
          r.prependMessages(history);
        }
      });
    },
    [mutate],
  );
  // Live message count for the orphan guard below (a ref, so the callback's
  // identity never changes: see the note on `onOrphanedConversation`).
  const messagesLenRef = useRef(0);
  messagesLenRef.current = state.messages.length;
  const onOrphanedConversation = useCallback(
    (id: string) => {
      if (conversationIdRef.current === id && messagesLenRef.current === 0) commitConversationId(null);
    },
    [commitConversationId],
  );

  const { isHydratingHistory, hydratedKeyRef } = useChatHistoryHydration({
    active,
    source,
    historyUrl,
    conversationId,
    hydrateMessages,
    // Drop a stored id the server no longer recognizes (deleted, or claimed by
    // an account while this browser is signed out): keeping it would stream
    // answers the server refuses to persist. Guarded on "no live turn yet" so
    // a just-minted id is never dropped.
    //
    // IDENTITY-STABLE by construction: this is a dependency of the hydration
    // effect, so a callback that changed with the message count would CANCEL
    // an in-flight hydration the moment the user typed, silently discarding
    // the thread they just opened. The live count is read through a ref.
    onOrphanedConversation,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  // Render-visible mirror of the ref: from the request until its reader has stopped.
  const [streamOpen, setStreamOpen] = useState(false);
  const openStream = useCallback((ctrl: AbortController) => {
    abortControllerRef.current = ctrl;
    setStreamOpen(true);
  }, []);
  /** Whether the turn is still this stream's to end: a stopped one may be followed by a send before its reader has stopped. */
  const closeStream = useCallback((ctrl: AbortController): boolean => {
    if (abortControllerRef.current !== ctrl) return false;
    abortControllerRef.current = null;
    setStreamOpen(false);
    return true;
  }, []);
  /** Stopped or left, a stream writes no more, whatever its reader is still doing. */
  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setStreamOpen(false);
  }, []);
  /**
   * A stream writes where the wire names and Stop reaches one request, so anything sent on top of one takes both: its answer
   * lands under the new question, and Stop misses the stream still writing.
   */
  const isStreamWriting = useCallback(() => {
    const ctrl = abortControllerRef.current;
    return ctrl !== null && !ctrl.signal.aborted;
  }, []);

  /** Switch the panel to another conversation (or to the draft state with
   *  `null`): abort any in-flight stream, flush + reset the reducer, re-arm
   *  the hydration guard, and commit the new id. `useChatHistoryHydration`
   *  then re-fetches for a non-null id through its `conversationId` dep. */
  const switchConversation = useCallback(
    (id: string | null) => {
      abortStream();
      flushDeltas();
      mutate(r => r.reset());
      hydratedKeyRef.current = null;
      commitConversationId(id);
    },
    [abortStream, flushDeltas, mutate, hydratedKeyRef, commitConversationId],
  );

  // ─── Managed dialog list (only with `chatConversationsUrl`) ───────────────
  // The SAME list state machine the NATS adapter runs; the host contract is
  // the hub's conversations route, spelled out once in
  // `chat-conversations-api.ts`. Without the endpoint the hook is inert and
  // the return shape below keeps the single-thread stubs — zero behaviour
  // change for hosts that never set it.
  const conversationsUrl = runtime.endpoints.chatConversationsUrl;
  const conversationsApi = useMemo(
    () => (conversationsUrl ? createChatConversationsApi(conversationsUrl) : null),
    [conversationsUrl],
  );
  const [dialogSearch, setDialogSearch] = useState('');
  const fetchActiveDialogs = useMemo(
    () =>
      conversationsApi
        ? (params: FetchDialogsParams) => conversationsApi.fetchDialogs({ ...params, status: 'active' })
        : undefined,
    [conversationsApi],
  );
  const fetchArchivedDialogs = useMemo(
    () =>
      conversationsApi
        ? (params: FetchDialogsParams) => conversationsApi.fetchDialogs({ ...params, status: 'archived' })
        : undefined,
    [conversationsApi],
  );
  const {
    dialogs,
    isDialogsLoading,
    dialogsError,
    hasMoreDialogs,
    reloadDialogs,
    loadMoreDialogs,
    renameDialog,
    archiveDialog,
    upsertDialogTop,
    bumpDialogToTop,
  } = useManagedDialogList({
    autoLoad: active,
    fetchDialogs: fetchActiveDialogs,
    renameDialog: conversationsApi?.renameDialog,
    archiveDialog: conversationsApi?.archiveDialog,
    pageSize: CHAT_HISTORY_PAGE_SIZE,
    search: conversationsApi ? dialogSearch : undefined,
    logTag: '[useSseChatAdapter]',
    // Archiving the OPEN conversation drops back to the draft state (the
    // manager also clears the thread; both paths are idempotent).
    onDialogRemoved: id => {
      if (conversationIdRef.current === id) switchConversation(null);
    },
  });
  const unarchiveDialog = useMemo(
    () =>
      conversationsApi
        ? async (id: string) => {
            await conversationsApi.unarchiveDialog(id);
            reloadDialogs();
          }
        : undefined,
    [conversationsApi, reloadDialogs],
  );

  // ─── Send / stream loop ────────────────────────────────────────────────────

  /**
   * Internal sendMessage options: the public `UnifiedSendMessageOptions` (semantic fields: `hidden`, `attachments`) and the
   * SSE-only `commandOverride` set by `discussRef` / `displayRef`.
   */
  type InternalSendMessageOptions = UnifiedSendMessageOptions & {
    commandOverride?: WireCommandOverride;
  };

  const endpointsRef = useRef(runtime.endpoints);
  endpointsRef.current = runtime.endpoints;

  /**
   * What the last stream turned out to be: the hub that answered it answers the next approval.
   * TODO(CU-17tkuw635xx): `old` keeps the old POST to `approvalToolUrl`, and the branch goes at the cleanup. A card is never
   * stored, so a card on screen always came with a stream that set this.
   */
  const wireRef = useRef<ChatStreamWire>('ui');

  /** Capture the SERVER-minted conversation id off a chunk. On the session's FIRST turn this is where the client learns
   *  its id: persist it so later turns and future visits continue the same conversation. */
  const captureConversationId = useCallback(
    (chunk: UiChunk): boolean => {
      const id = conversationIdOfChunk(chunk);
      if (id === null || conversationIdRef.current === id) return false;
      // Mark the new id as ALREADY hydrated before it becomes render state:
      // the turn being streamed IS its history, and a mount-style fetch here
      // would prepend that same turn once the server has persisted it.
      hydratedKeyRef.current = `${source}:${id}`;
      commitConversationId(id);
      return true;
    },
    [commitConversationId, hydratedKeyRef, source],
  );

  /** Keep the managed list in step with the transcript: a first turn re-reads the list (the server-derived title replaces
   *  the placeholder, the row is persisted by the time the stream ends); a later turn just bumps the row to the top. */
  const settleDialogList = useCallback(
    (mintedThisTurn: boolean, ctrl: AbortController) => {
      if (!conversationsApi || ctrl.signal.aborted) return;
      if (mintedThisTurn) {
        reloadDialogs();
      } else if (conversationIdRef.current) {
        // Re-insert at the TOP rather than patching in place: the server
        // has moved this row to the head of `last_message_at desc`, so an
        // in-place bump would leave the rail's order and its
        // Today/Yesterday grouping disagreeing with the server.
        bumpDialogToTop(conversationIdRef.current);
      }
    },
    [conversationsApi, reloadDialogs, bumpDialogToTop],
  );

  /**
   * One POST and the stream it answers, chunk by chunk through the reducer. Throws what the server said on a refused
   * request; an abort throws too, and the caller keeps what arrived. Returns whether this stream minted the conversation.
   */
  const streamFrom = useCallback(
    async (url: string, body: unknown, ctrl: AbortController, hidden: boolean | undefined): Promise<boolean> => {
      // `embedAuthedFetch` carries the bearer-act-as headers (+ Supabase session cookies): same wrapper
      // `use-chat-attachments` and `use-chat-identity` use.
      const response = await embedAuthedFetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!response.ok) {
        // Surface the SERVER's error copy (route-base envelope `{error, code}`): a bare "Chat request failed: 409" told the
        // user nothing when e.g. a batch approval expired; the server ships real copy ("This approval expired ...").
        const serverMessage = await readServerErrorMessage(response);
        const message = serverMessage ?? `Chat request failed: ${response.status}`;
        throw response.status < 500 ? new RequestRefused(message, serverMessage) : new Error(message);
      }
      if (!response.body) throw new Error('No response body');

      // The reader is per-request: a rapid send-stop-send sequence must never feed the second stream's first chunk into
      // the first stream's tail buffer.
      const reader = await createChatStreamReader(response);
      wireRef.current = reader.wire;
      let minted = false;
      for await (const chunk of reader.chunks) {
        if (ctrl.signal.aborted) break;
        if (captureConversationId(chunk)) {
          minted = true;
          // Optimistic row so the list shows the new conversation at once; the end-of-turn reload swaps in the server's
          // title. NEUTRAL placeholder: the SERVER owns titles (it strips slash commands + attachment markdown and cuts at
          // a word boundary), so guessing here would flash a `/command` token, and a naive slice can split an emoji.
          const mintedId = conversationIdRef.current;
          if (conversationsApi && !hidden && mintedId) {
            upsertDialogTop({ id: mintedId, title: 'New chat', timestamp: new Date() });
          }
        }
        applyEntry({ chunks: [chunk] });
      }
      return minted;
    },
    [applyEntry, captureConversationId, conversationsApi, upsertDialogTop],
  );

  const sendMessage = useCallback(
    // Resolves `true` on a clean turn, `false` when the request failed or a stream is open. Nothing in the panel offers a
    // send then (`isLoading` covers the open stream); this is for what cannot read that, and the click that beat a render.
    async (text: string, sendOptions?: InternalSendMessageOptions): Promise<boolean> => {
      if (isStreamWriting()) return false;
      const { hidden, attachments = [], commandOverride } = sendOptions ?? {};

      // `source` is INTENTIONALLY NOT in the body: the chat route resolves it server-side via its own platform-detection,
      // a tamper-proof binding.
      //
      // The server is the single source of conversation history: it re-reads `chat_messages` by conversation id on every
      // turn. The wire therefore carries ONLY the new user message, never the prior conversation.
      const echoedConversationId = conversationIdRef.current;
      const viewUrlPrefix = endpointsRef.current.attachmentViewUrlPrefix;
      const files = attachments.map(attachment => filePartOfAttachment(attachment, viewUrlPrefix));
      const requestBody = {
        // A value the server did not issue means a new conversation.
        id: echoedConversationId ?? newClientId('chat'),
        messages: [
          {
            id: newClientId('user'),
            role: 'user',
            parts: [...(text.length > 0 ? [{ type: 'text', text }] : []), ...files],
            // TODO(CU-17tkuw635xx): the old hub reads the message's `content`, with the attachments as markdown in it.
            content: text + attachments.map(att => formatChatAttachmentMarkdownForBubble(att, viewUrlPrefix)).join(''),
          },
        ],
        ...(commandOverride ? { commandOverride } : {}),
        // TODO(CU-17tkuw635xx): the old hub reads these, and the new one ignores them.
        ...(attachments.length > 0 ? { pendingAttachments: attachments } : {}),
        ...(echoedConversationId ? { conversationId: echoedConversationId } : {}),
      };

      // Optimistic user bubble + assistant placeholder + phase 'thinking': one reducer command.
      mutate(r => r.beginSseSend({ text, files, hidden }));

      const ctrl = new AbortController();
      openStream(ctrl);
      let minted = false;

      try {
        minted = await streamFrom(endpointsRef.current.chatStreamUrl, requestBody, ctrl, hidden);
        return true;
      } catch (err) {
        // AbortError on user-initiated stop is expected: keep the partial message, no error row, and DON'T report failure:
        // the request may have committed server-side.
        if ((err as { name?: string })?.name === 'AbortError' || ctrl.signal.aborted) {
          return true;
        }
        flushDeltas();
        mutate(r =>
          r.failTurn(err instanceof Error ? err.message : 'An error occurred while processing your request.'),
        );
        return false;
      } finally {
        const turnIsOurs = closeStream(ctrl);
        // Force-flush pending deltas BEFORE the completion state lands, then settle the turn (drops an empty trailing
        // placeholder and returns the phase to idle).
        flushDeltas();
        if (turnIsOurs) mutate(r => r.endSseTurn());
        settleDialogList(minted, ctrl);
      }
    },
    [mutate, flushDeltas, streamFrom, settleDialogList, openStream, closeStream, isStreamWriting],
  );

  /**
   * Answer an approval, by its `approval.id` or its batch's id. The standard's round trip (`addToolApprovalResponse`, then
   * "send only the last message"): the part flips, the card's message becomes the one being built, and the card's message
   * goes back holding the answered parts. The server's answer continues that message: an output or a denial per part (a
   * refusal is an error on ITS part, so one row of a batch can fail with its cross and the others proceed), the receipt,
   * and the auto-continuation. Resolves `false` when a row ended with no answer, and when a stream is open. The actions offer
   * no answer then, and this is for the click that landed before a render could say so.
   */
  const answerApproval = useCallback(
    async (id: string, approved: boolean, reason?: string): Promise<boolean> => {
      if (isStreamWriting()) return false;
      flushDeltas();
      const store = storeRef.current;
      const card = store ? cardOfApproval(store.getSnapshot(source).messages, id) : null;
      if (!card) return false;
      const { message, parts } = card;

      for (const part of parts) {
        const approvalId = 'approval' in part ? part.approval?.id : undefined;
        if (!approvalId) continue;
        applyEntry({
          chunks: [
            {
              type: 'tool-approval-response',
              approvalId,
              approved,
              ...(reason !== undefined ? { reason } : {}),
              toolMetadata: { answerSent: true },
            },
          ],
        });
      }
      mutate(r => r.continueMessage(message.id));

      const ctrl = new AbortController();
      openStream(ctrl);
      let ok = true;
      let minted = false;

      /**
       * One request, for these parts. A row it left waiting would spin for good: nothing else stops its loader, and a card
       * is never stored for a reload to settle it. So a request that was refused fails its rows with what the server said.
       * Anything else that left a row unanswered (a cut, Stop, a request that got no answer, a 5xx that may be a gateway's
       * word about a write still running) says that nobody knows how the row ended: the hub finishes a write it started
       * whether or not the client stays.
       */
      const answerParts = async (asked: readonly ChatToolPart[], url: string, body: unknown): Promise<void> => {
        let refusal: string | null = null;
        try {
          minted = (await streamFrom(url, body, ctrl, true)) || minted;
        } catch (err) {
          if (err instanceof RequestRefused) refusal = err.serverMessage ?? APPROVAL_REFUSED;
        }
        flushDeltas();
        for (const part of unansweredParts(store?.getSnapshot(source).messages ?? [], asked)) {
          applyEntry({
            chunks: [
              {
                type: 'tool-output-error',
                toolCallId: part.toolCallId,
                dynamic: true,
                errorText: refusal ?? APPROVAL_OUTCOME_UNKNOWN,
                ...(refusal === null ? { toolMetadata: { outcomeUnknown: true } } : {}),
              },
            ],
          });
          ok = false;
        }
      };

      try {
        if (wireRef.current === 'ui') {
          await answerParts(parts, endpointsRef.current.chatStreamUrl, {
            id: conversationIdRef.current,
            trigger: 'submit-message',
            messages: [
              {
                id: message.id,
                role: 'assistant',
                parts: parts.map(part => ({
                  type: 'dynamic-tool',
                  toolName: part.toolName,
                  toolCallId: part.toolCallId,
                  state: 'approval-responded',
                  input: part.input,
                  approval: {
                    id: 'approval' in part ? part.approval?.id : part.toolCallId,
                    approved,
                    ...(reason !== undefined ? { reason } : {}),
                  },
                })),
              },
            ],
          });
          return ok;
        }

        // TODO(CU-17tkuw635xx): the old hub resolves one proposal per request, and has a route for it. A batch runs serially,
        // and each answer ends its turn, so the card's message is named again before the next.
        for (const part of parts) {
          const proposalId = 'approval' in part ? part.approval?.id : undefined;
          if (!proposalId) continue;
          mutate(r => r.continueMessage(message.id));
          await answerParts(
            [part],
            endpointsRef.current.approvalToolUrl,
            buildConfirmToolBody({
              proposalId,
              action: approved ? 'approve' : 'reject',
              conversationId: conversationIdRef.current,
            }),
          );
        }
        return ok;
      } finally {
        const turnIsOurs = closeStream(ctrl);
        flushDeltas();
        if (turnIsOurs) mutate(r => r.endSseTurn());
        settleDialogList(minted, ctrl);
      }
    },
    [applyEntry, flushDeltas, mutate, settleDialogList, source, streamFrom, openStream, closeStream, isStreamWriting],
  );

  const stopMessage = useCallback(() => {
    abortStream();
    flushDeltas();
    // The turn ends here: what it said stays, and nothing is left reading as streaming.
    applyEntry({ chunks: [{ type: 'abort', reason: 'user' }] });
  }, [abortStream, applyEntry, flushDeltas]);

  const clearMessages = useCallback(() => {
    // Whatever is still streaming belongs to the thread being left: it must not draw in the new one.
    abortStream();
    flushDeltas();
    mutate(r => r.reset());
    // New chat = drop the stored conversation id. The old row stays frozen
    // server-side; the NEXT send goes out id-less and the server mints a
    // fresh conversation (echoed back and re-captured then). Resetting the
    // hydration guard means a re-captured id can hydrate again if needed.
    commitConversationId(null);
    hydratedKeyRef.current = null;
  }, [abortStream, flushDeltas, mutate, commitConversationId, hydratedKeyRef]);

  /** Open a conversation from the managed list. Idempotent on the active id. */
  const selectDialog = useCallback(
    (id: string | null) => {
      if (id === conversationIdRef.current) return;
      switchConversation(id);
    },
    [switchConversation],
  );

  // What a message's controls do: a stable object, the message memo compares it by reference. This transport has no
  // escalation offers. No approval is answered while a stream is open: a card's buttons read the absence (a Mingo turn may
  // be loading while paused on its own card, so the gate is this transport's and not the panel's).
  const asks = useMemo<ChatMessageActions>(
    () => ({
      // This adapter's `sendMessage` never rejects: it resolves `false` and renders the failure via `failTurn`.
      selectAsk: label => void sendMessage(label),
      pickSuggestion: prompt => void sendMessage(prompt),
    }),
    [sendMessage],
  );
  const asksAndAnswers = useMemo<ChatMessageActions>(
    () => ({
      ...asks,
      approve: id => answerApproval(id, true),
      reject: (id, reason) => answerApproval(id, false, reason),
    }),
    [asks, answerApproval],
  );
  const actions = streamOpen ? asks : asksAndAnswers;

  // Present ONLY with a conversations endpoint — its absence is what keeps a
  // Guide panel single-thread, and it is the single signal `EmbeddableChat`
  // gates the whole history surface on.
  const dialogCapabilities = useMemo<ChatDialogCapabilities | undefined>(
    () =>
      conversationsApi
        ? {
            canRename: true,
            canArchive: true,
            fetchArchivedDialogs,
            unarchiveDialog,
            searchQuery: dialogSearch,
            onSearchChange: setDialogSearch,
            // A public panel's first-time visitor must reach the composer
            // without tapping through an empty list.
            emptyListSkipsToCompose: true,
          }
        : undefined,
    [conversationsApi, fetchArchivedDialogs, unarchiveDialog, dialogSearch],
  );

  /**
   * "Display" callback for inline cards whose registry entry sets
   * `displayAction: true`. Parallel to `discussRef` but emits a
   * `/<cmd> display "<title>"` slash command instead of the Discuss prose.
   */
  const displayRef = useCallback(
    (reference: ChatRef) => {
      const tableId = tableIdForDocumentType(reference.type);
      if (!tableId) {
        console.warn(`[useSseChatAdapter] displayRef: no tableId for documentType="${reference.type}"; ignoring click`);
        return;
      }
      const cmdId = cmdIdByTableId.get(tableId);
      if (!cmdId) {
        console.warn(
          `[useSseChatAdapter] displayRef: no slash command for tableId="${tableId}" source="${source}"; ignoring click`,
        );
        return;
      }
      const refSlug =
        typeof reference.metadata?.slug === 'string' && reference.metadata.slug.length > 0
          ? reference.metadata.slug
          : '';
      const queryValue = refSlug || sanitizeTitleForChat(reference.title) || reference.id;
      // Escape `\` BEFORE `"` so a trailing backslash can't smuggle a
      // close-quote past parsers that honor JS-style escapes. Matches
      // `formatSingularLookupInvocation`'s pattern in slash-dispatch-utils.
      const escaped = queryValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const text = `/${cmdId} display "${escaped}"`;
      // This adapter's `sendMessage` never rejects: it resolves `false` and
      // renders the failure via `failTurn`. (The NATS copy's `discussRef`
      // needs an explicit `.catch` because its publish CAN reject.)
      void sendMessage(text);
    },
    [sendMessage, source, cmdIdByTableId, tableIdForDocumentType],
  );

  /**
   * "Discuss" affordance for ObjectCard. Synthesizes a natural-language
   * prompt ("Tell me more about <title>"); the structured
   * `commandOverride.entityIdFilter` is sent server-side via the request
   * body so retrieval narrows to the named row.
   */
  const discussRef = useCallback(
    (reference: ChatRef) => {
      const tableId = tableIdForDocumentType(reference.type);
      if (!tableId) {
        console.warn(`[useSseChatAdapter] discussRef: no tableId for documentType="${reference.type}"; ignoring click`);
        return;
      }
      const refId = (reference.id ?? '').trim();
      if (!refId) {
        console.warn(`[useSseChatAdapter] discussRef: empty reference.id for type="${reference.type}"; ignoring click`);
        return;
      }
      // RETRIEVAL IS STRICTLY PRIMARY-KEY-DRIVEN. The visible prose
      // ("Tell me more about <title>") is UX-only; retrieval narrows
      // via `entityIdFilter` before the LLM is invoked. The sentence itself
      // comes from the shared builder so the Mingo transport (which has no
      // id filter and leans on the prose) phrases it identically.
      const prompt = buildDiscussPrompt(reference);
      // Never rejects: see the note on `displayRef`.
      void sendMessage(prompt, {
        commandOverride: { entityIdFilter: { tableId, id: refId } },
      });
    },
    [sendMessage, tableIdForDocumentType],
  );

  // ─── Per-turn metadata resolution ─────────────────────────────────────────
  const usage = useMemo(() => latestUsageOf(state.messages), [state.messages]);
  const usageBreakdown = useMemo(() => usageBreakdownOf(usage?.breakdown), [usage]);

  const streamingPhase = state.streamingPhase;
  // `finish` stops naming the message, and the turn runs until its reader has stopped: until then it is still the one being
  // written, or the last message, a newer answer perhaps, would read as being written and rebuild its text for nothing.
  const lastWrittenRef = useRef<string | null>(null);
  lastWrittenRef.current = state.writingMessageId ?? (streamOpen ? lastWrittenRef.current : null);

  return {
    messages: state.messages,
    actions,
    // A stream's `finish` ends the phase before its reader has stopped: until it has, a send would be refused, and the
    // composer must not offer one it would clear for nothing.
    isLoading: streamingPhase !== 'idle' || streamOpen,
    sendMessage,
    /** "Discuss" affordance for ObjectCard. */
    discussRef,
    /** "Display" counterpart of `discussRef`. */
    displayRef,
    stopMessage,
    clearMessages,
    streamingPhase,
    writingMessageId: lastWrittenRef.current,
    /** True while the mount-time rebuild from the server transcript runs. */
    isHydratingHistory,
    /** Provider key for the lib's `<ModelDisplay>` icon. */
    currentProvider: state.liveModel?.provider ?? null,
    currentModelLabel: state.liveModel?.modelLabel ?? null,
    currentContextWindowMaxTokens: state.liveModel?.contextWindowMaxTokens ?? null,
    /** Input tokens (known after the stream's first usage; null until). */
    currentInputTokens: usage?.inputTokens ?? null,
    /** Output tokens (known only after the `finish` chunk's usage). */
    currentOutputTokens: usage?.outputTokens ?? null,
    currentContextTokens: usage?.contextTokens ?? null,
    /** Cache hit % (read / total-input × 100). null during streaming. */
    currentCacheHitRatePct: usage?.hit_rate_pct ?? null,
    /** Cross-call usage breakdown (Haiku rewriter/classifier/summarizer
     *  token counts). null until the `finish` chunk's usage lands. */
    currentUsageBreakdown: usageBreakdown,
    // ─── Dialog management ───────────────────────────────────────────────
    // With `chatConversationsUrl` the server transcript store IS the dialog
    // list (shared `useManagedDialogList`); selecting a row re-hydrates through
    // the history route. WITHOUT it the same hook is inert by construction:
    // no `fetchDialogs`, so an empty list, false flags and memoized no-op
    // mutations, which is why only the four genuinely mode-dependent fields
    // are branched here.
    dialogs,
    isDialogsLoading,
    dialogsError,
    reloadDialogs,
    hasMoreDialogs,
    loadMoreDialogs,
    renameDialog,
    archiveDialog,
    // New chat = `clearMessages` (the server mints on the next send); there is
    // no create call. Delete is not offered: archive replaces it.
    startNewDialog: noopStartNewDialog,
    deleteDialog: noopDeleteDialog,
    activeDialogId: conversationsApi ? conversationId : null,
    selectDialog: conversationsApi ? selectDialog : noopSelectDialog,
    isMessagesLoading: conversationsApi ? isHydratingHistory : false,
    dialogCapabilities,
    hasMoreMessages: false,
    loadMoreMessages: noopAsync,
    dialogTokenUsage: null,
    connectionState: 'connected' as const,
  };
}
