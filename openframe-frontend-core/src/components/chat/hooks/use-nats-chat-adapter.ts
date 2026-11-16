'use client';

/**
 * useNatsChatAdapter: the chat engine (`useChatEngine`) over the plain NATS WebSocket tail, configured by callbacks. A
 * host on another tail (JetStream, the Tauri bridge) calls `useChatEngine` with its own `ChatTransport` instead.
 */

import {
  natsWsLiveTail,
  type FetchDialogMessagesParams,
  type FetchDialogMessagesResult,
} from '../engine/chat-transport';
import { useChatEngine, type UseChatEngineConfig } from '../engine/use-chat-engine';
import type { FetchChunksFunction, NatsMessageType } from '../types';
import type { FetchDialogsParams, FetchDialogsResult, UnifiedChatState } from '../types/unified-chat-state.types';

/**
 * Consumer-supplied configuration for the NATS chat adapter.
 *
 * Every field except `getNatsWsUrl` + `publishUserMessage` is optional —
 * the lib does not assume a particular backend protocol or auth scheme.
 * Hosts wire these up against their own OpenFrame deployment.
 */
export interface UseNatsChatAdapterConfig {
  /**
   * Active conversation/dialog id. When omitted (`undefined`) the
   * adapter manages its own active dialog id internally — the host
   * drives selection through `selectDialog` / `startNewDialog`. When
   * explicitly set (including `null`) the adapter treats this as
   * controlled mode and uses the value verbatim. v0 consumers (the
   * Tauri Fae Chat client) pass an explicit id here and own the
   * lifecycle externally; v1+ consumers (the openframe-frontend
   * EmbeddableChat) leave it undefined and rely on `fetchDialogs`
   * for sidebar-driven selection.
   */
  dialogId?: string | null;

  /**
   * Build the NATS WebSocket URL. Returning `null` short-circuits the
   * subscription — same contract as `useNatsDialogSubscription`.
   */
  getNatsWsUrl: () => string | null;

  /**
   * Optional NATS client auth.
   */
  clientConfig?: {
    name?: string;
    user?: string;
    pass?: string;
  };

  /**
   * Send a user message upstream. Consumer-owned: typically an
   * authenticated HTTP POST to the OpenFrame chat endpoint, or a
   * direct NATS publish to a dedicated subject.
   *
   * The adapter does NOT couple to the wire format — it only:
   *   1. appends the user message to local state for immediate render
   *   2. flips streamingPhase to 'thinking' so the input UI shows status
   *   3. calls this callback
   *
   * Reply arrives asynchronously as NATS chunks via the live tail and
   * is accumulated into the trailing assistant message.
   */
  publishUserMessage: (text: string, options: { hidden?: boolean; dialogId: string | null }) => Promise<void> | void;

  /**
   * Historical-chunk fetcher used by `useChunkCatchup` to back-fill
   * events that happened while the user was in another mode or before
   * the websocket came online. Consumer-owned: typically a REST GET
   * against the OpenFrame chat-history endpoint.
   *
   * When omitted, `useChunkCatchup` falls back to its own default
   * fetch implementation — see hook docs for the contract.
   */
  fetchChunks?: FetchChunksFunction;

  /**
   * NATS topics to live-tail for the active dialog. Each maps to the
   * subject suffix `chat.{dialogId}.{topic}` (see
   * `useNatsDialogSubscription`). Defaults to `['message']` — the
   * client-chat subject the Tauri Fae Chat consumer relies on. Admin /
   * Mingo chat publishes its agent replies on `'admin-message'`, so the
   * openframe EmbeddableChat host MUST set `topics: ['admin-message']`
   * here — otherwise the subscription tails the wrong subject, no reply
   * chunks ever arrive, and the assistant placeholder hangs forever in
   * the `thinking` phase.
   */
  topics?: NatsMessageType[];

  /**
   * Approval types rendered as actionable cards inline (default `['CLIENT']`), the state's `displayApprovalTypes`. Hosts
   * whose backend emits other types (e.g. `USER`) MUST set this: otherwise such a card is not drawn until it is resolved.
   */
  displayApprovalTypes?: readonly string[];

  // ─── Managed-dialog mode (sidebar + history) ─────────────────────────────

  /**
   * Fetch a paginated page of dialogs for the sidebar. When provided,
   * the adapter switches to managed-dialog mode: it owns the active
   * dialog id, the dialog list, and pagination state. When omitted,
   * the adapter operates in bare-transport mode (current Tauri Fae
   * Chat usage) and the sidebar fields on the return value stay empty.
   */
  fetchDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>;

  /**
   * Fetch a page of historical messages for a dialog. Required for
   * sidebar-driven dialog switching — when omitted, selecting a
   * dialog brings up an empty thread until streaming starts.
   *
   * Rows arrive as the backend persists them (`HistoricalMessage`, its
   * `parts`), oldest first; `createMingoGraphqlHistory` reads them with the
   * lib's one document. The engine feeds them through `processHistoricalMessages`.
   */
  fetchDialogMessages?: (params: FetchDialogMessagesParams) => Promise<FetchDialogMessagesResult>;

  /**
   * Allocate a fresh dialog on the backend. Returns the new dialog id
   * which the adapter sets as the active dialog. When omitted, the
   * "Start new chat" affordance on the sidebar is hidden (or the host
   * can implement its own).
   */
  createDialog?: () => Promise<{ dialogId: string }>;

  /** Delete a dialog from history. When omitted, the sidebar item's
   *  delete affordance is hidden. */
  deleteDialog?: (dialogId: string) => Promise<void>;

  /** Rename a dialog on the backend. When omitted, the "Rename" affordance
   *  in the chat-history row menu is hidden. */
  renameDialog?: (dialogId: string, title: string) => Promise<void>;

  /** Archive a dialog on the backend (removes it from the active list).
   *  When omitted, the "Archive" affordance in the row menu is hidden. */
  archiveDialog?: (dialogId: string) => Promise<void>;

  /** Fetch a paginated page of ARCHIVED dialogs for the Chat Archive page.
   *  When omitted, the archive (clock-history) button in the header is
   *  hidden. Same page/cursor contract as `fetchDialogs`. */
  fetchArchivedDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>;

  /** Restore an archived dialog back to the active list. When omitted, the
   *  restore (refresh) button in an archived chat's header is hidden. */
  unarchiveDialog?: (dialogId: string) => Promise<void>;

  /**
   * Approve a pending tool-call request, by the id the backend knows it by. Card buttons reach it through the state's
   * `actions`. When omitted, approval cards render disabled buttons.
   */
  approveRequest?: (requestId: string) => Promise<void>;

  /** Reject counterpart of `approveRequest`. */
  rejectRequest?: (requestId: string, reason?: string) => Promise<void>;

  /** Accept an escalation offer: offers resolve through the ticket-escalation mutations, not the approval endpoint. */
  approveEscalation?: (offerId: string) => void | Promise<void>;

  /** Reject counterpart of `approveEscalation`. */
  rejectEscalation?: (offerId: string) => void | Promise<void>;

  /**
   * Cancel in-flight assistant generation. Without this, `stopMessage`
   * only flips the UI status — the backend continues until the agent
   * finishes naturally. With this, the backend stops emitting chunks.
   */
  stopGeneration?: (dialogId: string) => Promise<void>;

  /** Display name for the assistant in historical messages — defaults
   *  to `'Mingo'`. */
  assistantName?: string;

  /**
   * GraphQL `chatType` discriminator to filter historical messages by.
   * When set, `processHistoricalMessages` skips messages
   * whose `chatType` doesn't match. Openframe-frontend uses
   * `'ADMIN_AI_CHAT'` here.
   */
  chatTypeFilter?: string;

  /** Default page size for dialog list pagination. Defaults to 20. */
  dialogsPageSize?: number;

  /** Default page size for message history pagination. Defaults to 50. */
  messagesPageSize?: number;

  /**
   * Baseline model display for the composer's `<ModelDisplay>` — used as the
   * empty-state fallback before any `message-metadata` chunk arrives (e.g.
   * a brand-new chat). The host typically sources these from its AI-config
   * endpoint. Live `message-metadata` chunks refine them per-turn. NATS-only;
   * SSE (guide) derives its own model from the stream.
   */
  modelProvider?: string | null;
  modelLabel?: string | null;
}

/**
 * Per-call options for `useNatsChatAdapter`. Carries only the
 * activation gate — config travels through the config object so it
 * survives mode swaps without re-mounting.
 */
export interface UseNatsChatAdapterOptions {
  /**
   * When `false` the adapter goes idle: no NATS subscription, no
   * catchup fetch, no publish. Local message state is preserved so
   * the user sees their history when the mode flips back to active.
   * Default `true`.
   */
  active?: boolean;
}

// =============================================================================
// Hook
// =============================================================================

/** The engine configuration of a callback config: the plain NATS WebSocket tail and the callbacks as the ports. */
export function natsWsEngineConfig(config: UseNatsChatAdapterConfig): UseChatEngineConfig {
  const {
    getNatsWsUrl,
    clientConfig,
    topics,
    publishUserMessage,
    fetchChunks,
    stopGeneration,
    approveRequest,
    rejectRequest,
    approveEscalation,
    rejectEscalation,
  } = config;
  return {
    ...config,
    transport: {
      useLiveTail: natsWsLiveTail({ getNatsWsUrl, clientConfig, topics }),
      publish: publishUserMessage,
      fetchChunks,
      stop: stopGeneration,
      approve: approveRequest,
      reject: rejectRequest,
      approveEscalation,
      rejectEscalation,
    },
    history: config,
  };
}

export function useNatsChatAdapter(
  config: UseNatsChatAdapterConfig,
  options: UseNatsChatAdapterOptions = {},
): UnifiedChatState {
  return useChatEngine(natsWsEngineConfig(config), options);
}
