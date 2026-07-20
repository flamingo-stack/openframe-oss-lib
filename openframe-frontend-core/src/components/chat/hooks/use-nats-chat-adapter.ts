'use client'

/**
 * useNatsChatAdapter — the NATS/Mingo-mode transport adapter for the
 * unified chat surface. Companion of `useSseChatAdapter` (Guide mode);
 * both implement the same `UnifiedChatState` contract so the public
 * `useChat({ mode })` can dispatch between them with zero shell-side
 * branching.
 *
 * Composition layers (in order from low to high):
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ useNatsDialogSubscription   live tail of agent events        │
 *   │            ↓                                                 │
 *   │   onEvent → decodeNatsChunk → ChatStreamEvent                │
 *   │            ↓                                                 │
 *   │ createChatStreamReducer     THE master accumulation path     │
 *   │   (via ChatDialogStore + useChatStreamReducer wrapper —      │
 *   │    messages, phase, token usage, approvals all live there)   │
 *   │                                                              │
 *   │ useChunkCatchup             back-fill missed chunks after    │
 *   │                              activation / reconnect          │
 *   │                                                              │
 *   │ config.publishUserMessage   consumer-owned send (HTTP/NATS)  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Phase 3 of the chat unification: the adapter's local message-mutation
 * layer (`updateTrailingAssistant` / `appendToTrailingAssistant` /
 * `upsertTrailingCompaction` / `applyToolExecutionToMessages` and the
 * chunk-callback body that drove them) is DELETED — those semantics live in
 * `../stream/chat-stream-reducer` + `../stream/message-mutations` now. The
 * adapter owns only what is genuinely transport/host wiring: dialog-list
 * management, history fetch, catchup orchestration, the NATS subscription,
 * and the publish path.
 *
 * Two operating modes, distinguished by the presence of `fetchDialogs`:
 *
 *   1. **Bare-transport mode** (current Tauri Fae Chat usage):
 *      consumer supplies `config.dialogId` explicitly and owns dialog
 *      management above the adapter.
 *
 *   2. **Managed-dialog mode** (openframe-frontend, EmbeddableChat
 *      sidebar): consumer supplies `fetchDialogs`, `fetchDialogMessages`,
 *      `createDialog`, etc. and the adapter owns the dialog state machine.
 *
 * The `active` option gates the live subscription so the unified chat
 * shell can keep both adapters mounted while only paying network cost
 * for the currently-displayed mode.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNatsDialogSubscription } from './use-nats-dialog-subscription'
import { useChunkCatchup } from './use-chunk-catchup'
import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder'
import { createChatDialogStore, DEFAULT_DIALOG_SIDE } from '../stream/chat-dialog-store'
import { useChatStreamReducer } from '../stream/use-chat-stream-reducer'
import { processHistoricalMessagesWithErrors } from '../utils/process-historical-messages'
import { extractIncompleteTailState } from '../utils/extract-incomplete-message-state'
import type {
  ChunkData,
  FetchChunksFunction,
  HistoricalMessage,
  MessageProcessingOptions,
  MessageSegment,
  NatsMessageType,
  ChatApprovalStatus,
} from '../types'
import type {
  ChatConnectionState,
  DialogTokenUsage,
  UnifiedChatState,
  UnifiedChatMessage,
  UnifiedSendMessageOptions,
} from '../types/unified-chat-state.types'
import type { DialogItem } from '../types/component.types'
import type { ChatRef } from '../chat-ref.types'

// Legacy public home of the pure message-mutation helpers ("exported for
// host reuse"). Canonical implementation moved to the stream module in
// Phase 3 — these re-exports keep the import path stable until Phase 4
// migrates consumers.
export {
  appendToTrailingAssistant,
  applyToolExecutionToMessages,
  upsertTrailingCompaction,
} from '../stream/message-mutations'

// =============================================================================
// Config + options
// =============================================================================

/** Page-fetch parameters passed to `fetchDialogs`. The adapter owns the
 *  cursor — the host only resolves it against the backend. */
export interface FetchDialogsParams {
  cursor?: string
  limit?: number
  search?: string
}

/** Successful `fetchDialogs` response. `nextCursor: null` means "no more
 *  pages" — used to terminate the infinite-scroll observer in the
 *  sidebar. */
export interface FetchDialogsResult {
  dialogs: DialogItem[]
  nextCursor: string | null
}

/** Page-fetch parameters passed to `fetchDialogMessages`. */
export interface FetchDialogMessagesParams {
  dialogId: string
  cursor?: string
  limit?: number
}

/** Successful `fetchDialogMessages` response. `tokenUsage` is optional —
 *  some backends only attach it to the dialog header query, in which case
 *  hosts can either include it on the first page only (will populate the
 *  ModelDisplay readout) or fold it in via a separate update path. */
export interface FetchDialogMessagesResult {
  messages: HistoricalMessage[]
  nextCursor: string | null
  tokenUsage?: DialogTokenUsage | null
}

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
  dialogId?: string | null

  /**
   * Build the NATS WebSocket URL. Returning `null` short-circuits the
   * subscription — same contract as `useNatsDialogSubscription`.
   */
  getNatsWsUrl: () => string | null

  /**
   * Optional NATS client auth.
   */
  clientConfig?: {
    name?: string
    user?: string
    pass?: string
  }

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
  publishUserMessage: (
    text: string,
    options: { hidden?: boolean; dialogId: string | null },
  ) => Promise<void> | void

  /**
   * Historical-chunk fetcher used by `useChunkCatchup` to back-fill
   * events that happened while the user was in another mode or before
   * the websocket came online. Consumer-owned: typically a REST GET
   * against the OpenFrame chat-history endpoint.
   *
   * When omitted, `useChunkCatchup` falls back to its own default
   * fetch implementation — see hook docs for the contract.
   */
  fetchChunks?: FetchChunksFunction

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
  topics?: NatsMessageType[]

  /**
   * Mirrors the reducer's `batchApprovalsEnabled`. Default `true` —
   * single batch card per APPROVAL_REQUEST with `toolCalls[]`. Set
   * `false` to fall back to legacy per-tool cards.
   */
  batchApprovalsEnabled?: boolean

  /**
   * Approval types rendered as actionable cards inline. Mirrors the
   * reducer's `displayApprovalTypes` (default `['CLIENT']`) and is
   * forwarded to the history processor so both paths agree. Hosts whose
   * backend emits other types (e.g. `USER`) MUST set this — otherwise
   * those approvals are escalated to a callback this adapter doesn't
   * surface and the card never renders.
   */
  displayApprovalTypes?: string[]

  // ─── Managed-dialog mode (sidebar + history) ─────────────────────────────

  /**
   * Fetch a paginated page of dialogs for the sidebar. When provided,
   * the adapter switches to managed-dialog mode: it owns the active
   * dialog id, the dialog list, and pagination state. When omitted,
   * the adapter operates in bare-transport mode (current Tauri Fae
   * Chat usage) and the sidebar fields on the return value stay empty.
   */
  fetchDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>

  /**
   * Fetch a page of historical messages for a dialog. Required for
   * sidebar-driven dialog switching — when omitted, selecting a
   * dialog brings up an empty thread until streaming starts.
   *
   * Messages must arrive in the same wire shape the openframe backend
   * emits (HistoricalMessage with messageData[]); the adapter feeds
   * them through `processHistoricalMessagesWithErrors` to produce
   * reducer-compatible messages.
   */
  fetchDialogMessages?: (
    params: FetchDialogMessagesParams,
  ) => Promise<FetchDialogMessagesResult>

  /**
   * Allocate a fresh dialog on the backend. Returns the new dialog id
   * which the adapter sets as the active dialog. When omitted, the
   * "Start new chat" affordance on the sidebar is hidden (or the host
   * can implement its own).
   */
  createDialog?: () => Promise<{ dialogId: string }>

  /** Delete a dialog from history. When omitted, the sidebar item's
   *  delete affordance is hidden. */
  deleteDialog?: (dialogId: string) => Promise<void>

  /** Rename a dialog on the backend. When omitted, the "Rename" affordance
   *  in the chat-history row menu is hidden. */
  renameDialog?: (dialogId: string, title: string) => Promise<void>

  /** Archive a dialog on the backend (removes it from the active list).
   *  When omitted, the "Archive" affordance in the row menu is hidden. */
  archiveDialog?: (dialogId: string) => Promise<void>

  /** Fetch a paginated page of ARCHIVED dialogs for the Chat Archive page.
   *  When omitted, the archive (clock-history) button in the header is
   *  hidden. Same page/cursor contract as `fetchDialogs`. */
  fetchArchivedDialogs?: (
    params: FetchDialogsParams,
  ) => Promise<FetchDialogsResult>

  /** Restore an archived dialog back to the active list. When omitted, the
   *  restore (refresh) button in an archived chat's header is hidden. */
  unarchiveDialog?: (dialogId: string) => Promise<void>

  /**
   * Approve a pending tool-call request. Wired into the reducer's
   * approval-card callbacks so card buttons fire this directly. When
   * omitted, approval cards render disabled buttons.
   */
  approveRequest?: (requestId: string) => Promise<void>

  /** Reject counterpart of `approveRequest`. */
  rejectRequest?: (requestId: string, reason?: string) => Promise<void>

  /**
   * Cancel in-flight assistant generation. Without this, `stopMessage`
   * only flips the UI status — the backend continues until the agent
   * finishes naturally. With this, the backend stops emitting chunks.
   */
  stopGeneration?: (dialogId: string) => Promise<void>

  /** Display name for the assistant in historical messages — defaults
   *  to `'Mingo'`. */
  assistantName?: string

  /**
   * GraphQL `chatType` discriminator to filter historical messages by.
   * When set, `processHistoricalMessagesWithErrors` skips messages
   * whose `chatType` doesn't match. Openframe-frontend uses
   * `'ADMIN_AI_CHAT'` here.
   */
  chatTypeFilter?: string

  /** Default page size for dialog list pagination. Defaults to 20. */
  dialogsPageSize?: number

  /** Default page size for message history pagination. Defaults to 50. */
  messagesPageSize?: number

  /**
   * Baseline model display for the composer's `<ModelDisplay>` — used as the
   * empty-state fallback before any streaming `metadata` frame arrives (e.g.
   * a brand-new chat). The host typically sources these from its AI-config
   * endpoint. Live `metadata` frames refine them per-turn. NATS-only; SSE
   * (guide) derives its own model from the stream.
   */
  modelProvider?: string | null
  modelLabel?: string | null
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
  active?: boolean
}

// =============================================================================
// Historical-message mapping helpers (host-facing)
// =============================================================================

/**
 * Map `ProcessedMessage` (lib's historical-message format) into
 * `UnifiedChatMessage` (the unified-chat-state contract). Only `user`
 * and `assistant` roles round-trip; `error` is dropped on the floor
 * here because the unified contract surfaces errors as banners, not
 * inline messages. (Hosts that need inline error bubbles can extend
 * the contract later.)
 *
 * Exported for host reuse (e.g. scripted marketing demos that rehydrate a
 * stored `HistoricalMessage[]` via `processHistoricalMessagesWithErrors` and
 * feed a `previewMode` EmbeddableChat). This mapper carries the segment/content
 * shape only; author identity (name/avatar/authorType/timestamp) that a host
 * needs for the demo is re-attached by the host from the same processed rows.
 */
export function mapProcessedToUnified(
  processed: Array<{
    id: string
    role: 'user' | 'assistant' | 'error'
    content: string | MessageSegment[]
    name?: string
  }>,
): UnifiedChatMessage[] {
  const out: UnifiedChatMessage[] = []
  for (const m of processed) {
    if (m.role === 'error') continue
    if (Array.isArray(m.content)) {
      out.push({
        id: m.id,
        role: m.role,
        content: '',
        segments: m.content,
      })
    } else {
      out.push({
        id: m.id,
        role: m.role,
        content: m.content,
      })
    }
  }
  return out
}

/**
 * ONE-CALL `HistoricalMessage[]` -> `UnifiedChatMessage[]` for hosts replaying a
 * stored conversation outside the live adapter (scripted marketing demos, a
 * `previewMode` EmbeddableChat). Does the full pipeline the adapter does inline:
 * `processHistoricalMessagesWithErrors` -> `mapProcessedToUnified` -> re-attach
 * the author identity (name / avatar / authorType / timestamp) the segment
 * mapper drops. Hosts no longer hand-roll the two-step + re-attach.
 */
export function historicalToUnified(
  messages: HistoricalMessage[],
  options: MessageProcessingOptions = {},
): UnifiedChatMessage[] {
  const { messages: processed } = processHistoricalMessagesWithErrors(messages, options)
  const byId = new Map(processed.map((p) => [p.id, p]))
  return mapProcessedToUnified(processed).map((u) => {
    const p = byId.get(u.id)
    return p
      ? { ...u, name: p.name, avatar: p.avatar ?? null, authorType: p.authorType, timestamp: p.timestamp }
      : u
  })
}

// =============================================================================
// Hook
// =============================================================================

/** Store key for the draft ("no dialog selected") state. */
const DRAFT_DIALOG_KEY = '__draft__'

export function useNatsChatAdapter(
  config: UseNatsChatAdapterConfig,
  options: UseNatsChatAdapterOptions = {},
): UnifiedChatState {
  const { active = true } = options
  const {
    dialogId: controlledDialogId,
    getNatsWsUrl,
    clientConfig,
    publishUserMessage,
    fetchChunks,
    topics,
    batchApprovalsEnabled,
    displayApprovalTypes,
    fetchDialogs,
    fetchDialogMessages,
    createDialog: createDialogCallback,
    deleteDialog: deleteDialogCallback,
    renameDialog: renameDialogCallback,
    archiveDialog: archiveDialogCallback,
    approveRequest: approveRequestCallback,
    rejectRequest: rejectRequestCallback,
    stopGeneration: stopGenerationCallback,
    assistantName = 'Mingo',
    chatTypeFilter,
    dialogsPageSize = 20,
    messagesPageSize = 50,
    modelProvider = null,
    modelLabel = null,
  } = config

  // ─── Active dialog id resolution ──────────────────────────────────────────
  // The discriminator is *capability*, not *value*: when the host wires
  // `fetchDialogs` we know they want the adapter to own the dialog list,
  // active id, and sidebar wiring. Any `controlledDialogId` they pass in
  // that mode is ignored (host shouldn't be fighting the adapter for
  // selection). When `fetchDialogs` is absent (Tauri Fae Chat) the adapter
  // is in bare-transport mode and the host's `dialogId` is the source of
  // truth — including `null`, which means "no dialog selected, idle WS".

  const isManagedMode = fetchDialogs !== undefined
  const [internalDialogId, setInternalDialogId] = useState<string | null>(null)
  const dialogId = isManagedMode
    ? internalDialogId
    : controlledDialogId !== undefined
    ? controlledDialogId
    : null

  // Render-synchronous mirror of the active dialog. Async continuations
  // (reconnect back-fill, catchup finallys) capture `dialogId` at start and
  // compare against this ref when they resume — a continuation whose dialog
  // is no longer active must not touch the new dialog's flags.
  const currentDialogIdRef = useRef<string | null>(dialogId)
  currentDialogIdRef.current = dialogId

  // ─── Approval handlers ────────────────────────────────────────────────────
  // Defined before the reducer so the reducer's create-options can wire the
  // approval-card buttons. Optimistically flip status before the network
  // round-trip so the card reflects the user's choice immediately.

  const handleApproveRef = useRef<(requestId: string) => Promise<void>>(async () => {})
  const handleRejectRef = useRef<(requestId: string, reason?: string) => Promise<void>>(
    async () => {},
  )

  // Reducer-card adapters. The card contract is `(requestId?) => void |
  // Promise<void>` — single optional arg; narrow at the boundary.
  const accumApprove = useCallback((requestId?: string): void | Promise<void> => {
    if (!requestId) return
    return handleApproveRef.current(requestId)
  }, [])
  const accumReject = useCallback((requestId?: string): void | Promise<void> => {
    if (!requestId) return
    return handleRejectRef.current(requestId)
  }, [])

  // ─── THE reducer (master stream reader) ───────────────────────────────────
  // One `ChatDialogStore` per adapter instance; one reducer per dialog.
  // Approval statuses are request-id-keyed and GLOBAL across dialogs (a
  // resolved approval must not resurrect as actionable after a dialog
  // switch), so the adapter accumulates them into a ref that seeds every
  // newly-created per-dialog reducer.

  const storeRef = useRef(createChatDialogStore())
  const globalApprovalStatusesRef = useRef<Record<string, ChatApprovalStatus>>({})
  const dialogKey = dialogId ?? DRAFT_DIALOG_KEY

  const { state, applyEvent, mutate } = useChatStreamReducer({
    store: storeRef.current,
    dialogId: dialogKey,
    createReducerOptions: () => ({
      transport: 'nats',
      batchApprovalsEnabled,
      ...(displayApprovalTypes ? { displayApprovalTypes } : {}),
      approvalStatuses: globalApprovalStatusesRef.current,
      callbacks: { onApprove: accumApprove, onReject: accumReject },
    }),
  })

  // Accumulate resolved statuses globally (render-time merge is cheap and
  // keeps the ref current for the next dialog's reducer seed).
  globalApprovalStatusesRef.current = {
    ...globalApprovalStatusesRef.current,
    ...state.approvalStatuses,
  }

  // Live handleApprove/handleReject bodies (need `mutate` + state access).
  handleApproveRef.current = async (requestId: string) => {
    if (!approveRequestCallback) return
    // Approval hands the turn back to the agent — lock the composer now
    // rather than waiting for the APPROVAL_RESULT/EXECUTING_TOOL chunks.
    // Remember whether THIS click took the lock: if the phase was already
    // busy (another approval's command executing), a failure of this
    // request must not release a lock it doesn't own.
    const store = storeRef.current
    const key = dialogKey
    const tookLock = store.mutate(key, DEFAULT_DIALOG_SIDE, (r) => {
      const took = r.state.streamingPhase === 'idle'
      r.setApprovalStatus(requestId, 'approved')
      if (took) r.setPhase('thinking')
      return took
    })
    try {
      await approveRequestCallback(requestId)
    } catch (err) {
      // Revert the optimistic flip on failure so the user can retry.
      store.mutate(key, DEFAULT_DIALOG_SIDE, (r) => {
        r.setApprovalStatus(requestId, null)
        if (tookLock && r.state.streamingPhase === 'thinking') r.setPhase('idle')
      })
      console.error('[useNatsChatAdapter] approveRequest failed:', err)
    }
  }
  handleRejectRef.current = async (requestId: string, reason?: string) => {
    if (!rejectRequestCallback) return
    // Deliberately NO phase lock here (asymmetric with approve): rejection
    // keeps the composer free so the user can type a correction right away —
    // the reducer's `approved`-only agent-busy gate is the same asymmetry.
    const store = storeRef.current
    const key = dialogKey
    store.mutate(key, DEFAULT_DIALOG_SIDE, (r) => r.setApprovalStatus(requestId, 'rejected'))
    try {
      await rejectRequestCallback(requestId, reason)
    } catch (err) {
      store.mutate(key, DEFAULT_DIALOG_SIDE, (r) => r.setApprovalStatus(requestId, null))
      console.error('[useNatsChatAdapter] rejectRequest failed:', err)
    }
  }

  // Decode + apply — the ONLY chunk entry point (catchup routes the live
  // tail through here too, so buffering/dedupe stay consistent).
  const processChunk = useCallback(
    (chunk: unknown) => {
      const event = decodeNatsChunk(chunk)
      if (event) applyEvent(event)
    },
    [applyEvent],
  )

  // ─── Dialog list state (managed-dialog mode only) ─────────────────────────

  const [dialogs, setDialogs] = useState<DialogItem[]>([])
  const [dialogsNextCursor, setDialogsNextCursor] = useState<string | null>(null)
  const [isDialogsLoading, setIsDialogsLoading] = useState<boolean>(false)
  const [dialogsError, setDialogsError] = useState<boolean>(false)
  const [isCreatingDialog, setIsCreatingDialog] = useState<boolean>(false)

  // ─── Message-history pagination ───────────────────────────────────────────

  const [messagesNextCursor, setMessagesNextCursor] = useState<string | null>(null)
  const [isMessagesLoading, setIsMessagesLoading] = useState<boolean>(false)

  // ─── Connection state ─────────────────────────────────────────────────────

  const [connectionState, setConnectionState] =
    useState<ChatConnectionState>('connecting')

  // Set after the first successful NATS connect. Later 'connected' events are
  // RECONNECTS: plain NATS replays nothing, so the adapter must back-fill the
  // disconnect gap via `resetAndCatchUp` or those chunks are lost forever.
  const hasConnectedOnceRef = useRef(false)

  // History catchup — back-fills chunks emitted while the adapter was
  // inactive or before the WS came online.
  const {
    processChunk: catchupProcessChunk,
    catchUpChunks,
    startInitialBuffering,
    resetChunkTracking,
    resetAndCatchUp,
    isBufferingActive,
  } = useChunkCatchup({
    dialogId: active ? dialogId : null,
    onChunkReceived: (chunk: ChunkData) => processChunk(chunk),
    fetchChunks,
  })

  // ─── Historical message hydration ─────────────────────────────────────────
  // When the active dialog changes AND a `fetchDialogMessages` callback
  // is wired, load the first page of history, process it through the
  // history decoder + envelope, and seed the reducer. Streaming chunks for
  // the same dialog then append on top.

  // Monotonic guard: each history load captures a sequence number; when a
  // response resolves, it only applies if it's still the latest request. This
  // prevents a slow response for a previously-selected dialog from clobbering
  // the state of the dialog the user just switched to.
  const historyLoadSeqRef = useRef(0)

  const loadDialogHistory = useCallback(
    async (id: string, cursor?: string): Promise<void> => {
      if (!fetchDialogMessages) return
      historyLoadSeqRef.current += 1
      const seq = historyLoadSeqRef.current
      const store = storeRef.current
      setIsMessagesLoading(true)
      try {
        const result = await fetchDialogMessages({
          dialogId: id,
          cursor,
          limit: messagesPageSize,
        })
        // Ignore stale responses superseded by a newer dialog selection.
        if (seq !== historyLoadSeqRef.current) return
        const { messages: rawProcessed } = processHistoricalMessagesWithErrors(
          result.messages,
          {
            assistantName,
            assistantType: 'mingo',
            chatTypeFilter,
            onApprove: accumApprove,
            onReject: accumReject,
            approvalStatuses: store.getSnapshot(id).approvalStatuses,
            batchApprovalsEnabled,
            ...(displayApprovalTypes ? { displayApprovalTypes } : {}),
          },
        )
        const unified = mapProcessedToUnified(rawProcessed)
        store.mutate(id, DEFAULT_DIALOG_SIDE, (r) => {
          if (cursor === undefined) {
            // First page — replace. When the trailing assistant is an
            // INCOMPLETE turn, the catchup replay will re-stream it from its
            // MESSAGE_START — let that stream adopt (replace) the partial
            // bubble instead of opening a duplicate one.
            // Gated on an ACTIVE catchup buffer: when the catchup already
            // finalized before this history page resolved, no replay is
            // coming to consume the flag — arming it anyway would hand the
            // adoption to the NEXT genuine turn, which would overwrite the
            // partial bubble instead of opening a fresh one.
            // `extractIncompleteTailState` (not the single-row extractor):
            // one logical turn can span several trailing assistant bubbles,
            // so the unfinished artifact may sit above the last row.
            r.armAdoptTrailingAssistant(
              isBufferingActive() && extractIncompleteTailState(rawProcessed) !== undefined,
            )
            r.setMessages(unified)
          } else {
            // Older page — prepend.
            r.prependMessages(unified)
          }
          if (result.tokenUsage !== undefined) {
            r.setDialogTokenUsage(result.tokenUsage ?? null)
          }
        })
        setMessagesNextCursor(result.nextCursor)
      } catch (err) {
        console.error('[useNatsChatAdapter] fetchDialogMessages failed:', err)
      } finally {
        // Only the latest request owns the loading flag — a superseded one
        // must not clear it while the newer load is still in flight.
        if (seq === historyLoadSeqRef.current) {
          setIsMessagesLoading(false)
        }
      }
    },
    [
      fetchDialogMessages,
      messagesPageSize,
      assistantName,
      chatTypeFilter,
      batchApprovalsEnabled,
      displayApprovalTypes,
      accumApprove,
      accumReject,
      isBufferingActive,
    ],
  )

  // Reset + reload when the active dialog changes.
  const prevDialogIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (prevDialogIdRef.current === dialogId) return
    prevDialogIdRef.current = dialogId

    // Invalidate any in-flight history load for the previous dialog. Bumping
    // here (not only inside loadDialogHistory) covers the clear/delete path
    // — switching to a null/empty dialog never starts a new load, so without
    // this an in-flight response could repopulate the just-cleared state.
    historyLoadSeqRef.current += 1

    // Clean slate for the (re)entered dialog: thread, per-turn kernel,
    // participant dedup sets, seq gate, phase. Approval statuses survive
    // per-reducer AND get topped up with the adapter's global map (request
    // ids are dialog-independent).
    storeRef.current.mutate(dialogKey, DEFAULT_DIALOG_SIDE, (r) => {
      r.resetForDialogSwitch()
      r.syncApprovalStatuses({
        ...globalApprovalStatusesRef.current,
        ...r.state.approvalStatuses,
      })
    })
    // No load runs when there's no active dialog, so clear the flag here;
    // otherwise the superseded load's guarded `finally` leaves it stuck on.
    setMessagesNextCursor(null)
    setIsMessagesLoading(false)

    if (!active || !dialogId) return

    // Hydrate history first; then catchup will fold in any chunks that
    // landed between the history snapshot and the live tail.
    void loadDialogHistory(dialogId)
  }, [active, dialogId, dialogKey, loadDialogHistory])

  // Trigger initial chunk backfill whenever a fresh dialog activates.
  // Runs alongside history hydration — history seeds processed messages,
  // catchup buffers raw chunks in case the WS came online after history
  // was already snapshotted.
  useEffect(() => {
    if (!active || !dialogId) return
    const store = storeRef.current
    // Gate agent-busy locks for the replay window: a dead tail (approval
    // approved / tool started, then Stop or a crash) replays its
    // APPROVAL_RESULT / EXECUTING_TOOL chunks on every dialog (re)open, and
    // the releasing MESSAGE_END never replays — locking the composer
    // forever. The suppression is a COUNTER inside the reducer: the
    // initial-catchup window and a reconnect back-fill window can overlap.
    store.mutate(dialogId, DEFAULT_DIALOG_SIDE, (r) => r.adjustAgentBusySuppression(1))
    resetChunkTracking()
    startInitialBuffering()
    catchUpChunks()
      .catch((err) => {
        console.error('[useNatsChatAdapter] initial catchup failed:', err)
      })
      .finally(() => {
        store.mutate(dialogId, DEFAULT_DIALOG_SIDE, (r) => {
          r.adjustAgentBusySuppression(-1)
          // The adopt-once flag targets the replayed MESSAGE_START of the
          // incomplete history tail. When the replay produced none (chunk
          // store expired past its ~10-min retention / empty), the armed
          // flag would survive and make the NEXT genuine turn adopt-and-
          // overwrite the partial bubble.
          r.armAdoptTrailingAssistant(false)
        })
      })
  }, [active, dialogId, resetChunkTracking, startInitialBuffering, catchUpChunks])

  // ─── Live NATS subscription ───────────────────────────────────────────────
  // Gated on `active` and a non-null dialogId so the consumer doesn't pay
  // socket cost before a conversation exists.

  useNatsDialogSubscription({
    enabled: active && dialogId != null,
    dialogId,
    // Subject suffix to tail. Omitted → the hook defaults to `['message']`
    // (client chat). Admin/Mingo hosts pass `['admin-message']` so the
    // live tail lands on the subject the agent actually publishes to.
    ...(topics ? { topics } : {}),
    getNatsWsUrl,
    clientConfig,
    onEvent: (payload: unknown, messageType: NatsMessageType) => {
      // Route via catchup so the buffer/dedupe logic stays consistent
      // with historical playback. `useChunkCatchup` itself forwards to
      // `processChunk` once dedupe checks pass.
      catchupProcessChunk(payload as ChunkData, messageType)
      // First successful event marks the connection as up.
      setConnectionState('connected')
    },
    onConnect: () => {
      // Plain NATS pub/sub has no replay: chunks published while the socket
      // was down are gone unless we back-fill. The FIRST connect is covered
      // by the initial catchup effect; every later one is a reconnect.
      if (!hasConnectedOnceRef.current) {
        hasConnectedOnceRef.current = true
        return
      }
      const store = storeRef.current
      const reconnectDialogId = dialogId
      if (reconnectDialogId) {
        store.mutate(reconnectDialogId, DEFAULT_DIALOG_SIDE, (r) =>
          r.adjustAgentBusySuppression(1),
        )
      }
      // Buffer live deliveries for the WHOLE back-fill, including the history
      // await — otherwise chunks landing mid-fetch are processed unbuffered
      // (advancing lastSequenceId + dedup keys) and the history replace then
      // wipes their content with no way to replay them. `resetAndCatchUp`
      // keeps an already-active buffer, so nothing collected here is lost.
      startInitialBuffering()
      void (async () => {
        try {
          // History FIRST: the backend never stores DIRECT_MESSAGE/SYSTEM
          // chunks in its catchup store (instant types go straight to Mongo),
          // so the chunk back-fill can't recover them — the persisted history
          // page is the only source. Then replay the unsaved chunk tail on
          // top of the fresh snapshot.
          if (reconnectDialogId && fetchDialogMessages) {
            await loadDialogHistory(reconnectDialogId)
          }
          // The user may have switched dialogs during the await — the new
          // dialog's own effects run their catchup cycle; re-running it here
          // would reset that cycle mid-flight.
          if (reconnectDialogId !== currentDialogIdRef.current) return
          await resetAndCatchUp()
        } catch (err) {
          console.error('[useNatsChatAdapter] reconnect catchup failed:', err)
        } finally {
          if (reconnectDialogId) {
            store.mutate(reconnectDialogId, DEFAULT_DIALOG_SIDE, (r) => {
              r.adjustAgentBusySuppression(-1)
              // The adopt-once flag targets the replayed MESSAGE_START of the
              // incomplete tail — but on reconnect that START was already
              // consumed live and is dedup-skipped by the replay, so it never
              // fires. Clear the flag or the NEXT genuine turn adopts (and
              // overwrites) the completed trailing bubble.
              r.armAdoptTrailingAssistant(false)
            })
          }
        }
      })()
    },
  })

  // Without a finer hook signal we treat "active + dialog selected" as
  // connecting until the first event lands, and "no dialog" as idle-
  // connected (nothing to subscribe to anyway).
  useEffect(() => {
    if (!active || !dialogId) {
      setConnectionState('connected')
      return
    }
    setConnectionState('connecting')
  }, [active, dialogId])

  // ─── Dialog list management (managed-dialog mode) ─────────────────────────

  // Forward-declared so `loadDialogsPage` can reset the initial-load guard on
  // a first-page failure (enabling retry / auto-retry on re-activation).
  const initialDialogsLoadedRef = useRef(false)

  const loadDialogsPage = useCallback(
    async (cursor?: string): Promise<void> => {
      if (!fetchDialogs) return
      setIsDialogsLoading(true)
      // Clear a prior first-page error when (re)loading the first page.
      if (cursor === undefined) setDialogsError(false)
      try {
        const result = await fetchDialogs({
          cursor,
          limit: dialogsPageSize,
        })
        setDialogsNextCursor(result.nextCursor)
        if (cursor === undefined) {
          setDialogs(result.dialogs)
        } else {
          setDialogs((prev) => [...prev, ...result.dialogs])
        }
      } catch (err) {
        console.error('[useNatsChatAdapter] fetchDialogs failed:', err)
        // Only the FIRST page failing is a "can't show the list" error — a
        // pagination failure keeps the already-loaded list intact. Flag it and
        // release the initial-load guard so a retry (or re-activation) re-runs.
        if (cursor === undefined) {
          setDialogsError(true)
          initialDialogsLoadedRef.current = false
        }
      } finally {
        setIsDialogsLoading(false)
      }
    },
    [fetchDialogs, dialogsPageSize],
  )

  // Retry the initial dialog-list load after a failure.
  const reloadDialogs = useCallback(() => {
    void loadDialogsPage()
  }, [loadDialogsPage])

  // Initial dialog list load.
  useEffect(() => {
    if (!fetchDialogs) return
    if (!active) return
    if (initialDialogsLoadedRef.current) return
    initialDialogsLoadedRef.current = true
    void loadDialogsPage()
  }, [active, fetchDialogs, loadDialogsPage])

  // ─── Public action handlers ───────────────────────────────────────────────

  const sendMessage = useCallback(
    async (
      text: string,
      sendOptions?: UnifiedSendMessageOptions,
    ): Promise<void> => {
      const hidden = sendOptions?.hidden ?? false

      // Optimistically append the user bubble + an empty assistant
      // placeholder, record the echo text, and flip the phase — all inside
      // the reducer. The assistant body fills in as NATS chunks land.
      mutate((r) => r.pushOptimisticSend(text, hidden))

      await publishUserMessage(text, { hidden, dialogId })
    },
    [mutate, publishUserMessage, dialogId],
  )

  const stopMessage = useCallback(() => {
    // Best-effort UI flip. The actual backend cancellation is gated on
    // the host-supplied callback.
    mutate((r) => r.setPhase('idle'))
    if (stopGenerationCallback && dialogId) {
      void stopGenerationCallback(dialogId).catch((err) => {
        console.error('[useNatsChatAdapter] stopGeneration failed:', err)
      })
    }
  }, [mutate, stopGenerationCallback, dialogId])

  const clearMessages = useCallback(() => {
    mutate((r) => r.clearThread())
  }, [mutate])

  const selectDialog = useCallback(
    (id: string | null) => {
      if (!isManagedMode) {
        // Bare-transport mode: the host owns dialog id externally. No-op
        // here so we don't compete with the host's own state machine.
        // Hosts wanting EmbeddableChat-driven selection should wire
        // `fetchDialogs` to flip the adapter into managed-dialog mode.
        return
      }
      setInternalDialogId(id)
    },
    [isManagedMode],
  )

  const startNewDialog = useCallback(async (): Promise<string | null> => {
    if (!createDialogCallback) return null
    if (isCreatingDialog) return null
    try {
      setIsCreatingDialog(true)
      const result = await createDialogCallback()
      // Optimistically prepend a placeholder dialog so the sidebar shows
      // the new conversation immediately. The next list refresh will
      // replace it with the canonical entry.
      setDialogs((prev) => [
        {
          id: result.dialogId,
          title: 'New Chat',
          timestamp: new Date(),
        },
        ...prev.filter((d) => d.id !== result.dialogId),
      ])
      if (isManagedMode) {
        setInternalDialogId(result.dialogId)
      }
      return result.dialogId
    } catch (err) {
      console.error('[useNatsChatAdapter] createDialog failed:', err)
      return null
    } finally {
      setIsCreatingDialog(false)
    }
  }, [createDialogCallback, isCreatingDialog, isManagedMode])

  const deleteDialog = useCallback(
    async (id: string): Promise<void> => {
      if (!deleteDialogCallback) return
      try {
        await deleteDialogCallback(id)
        setDialogs((prev) => prev.filter((d) => d.id !== id))
        storeRef.current.remove(id)
        if (isManagedMode && internalDialogId === id) {
          setInternalDialogId(null)
        }
      } catch (err) {
        console.error('[useNatsChatAdapter] deleteDialog failed:', err)
      }
    },
    [deleteDialogCallback, internalDialogId, isManagedMode],
  )

  const renameDialog = useCallback(
    async (id: string, title: string): Promise<void> => {
      if (!renameDialogCallback) return
      // Optimistic — update the local title immediately, roll back on error.
      let previous: string | undefined
      setDialogs((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d
          previous = d.title
          return { ...d, title }
        }),
      )
      try {
        await renameDialogCallback(id, title)
      } catch (err) {
        console.error('[useNatsChatAdapter] renameDialog failed:', err)
        if (previous !== undefined) {
          setDialogs((prev) =>
            prev.map((d) => (d.id === id ? { ...d, title: previous! } : d)),
          )
        }
      }
    },
    [renameDialogCallback],
  )

  const archiveDialog = useCallback(
    async (id: string): Promise<void> => {
      if (!archiveDialogCallback) return
      try {
        await archiveDialogCallback(id)
        setDialogs((prev) => prev.filter((d) => d.id !== id))
        if (isManagedMode && internalDialogId === id) {
          setInternalDialogId(null)
        }
      } catch (err) {
        console.error('[useNatsChatAdapter] archiveDialog failed:', err)
      }
    },
    [archiveDialogCallback, internalDialogId, isManagedMode],
  )

  const loadMoreDialogs = useCallback(async (): Promise<void> => {
    if (!dialogsNextCursor) return
    await loadDialogsPage(dialogsNextCursor)
  }, [dialogsNextCursor, loadDialogsPage])

  const loadMoreMessages = useCallback(async (): Promise<void> => {
    if (!dialogId || !messagesNextCursor) return
    await loadDialogHistory(dialogId, messagesNextCursor)
  }, [dialogId, messagesNextCursor, loadDialogHistory])

  const approveRequest = useCallback(
    async (requestId: string) => {
      await handleApproveRef.current(requestId)
    },
    [],
  )

  const rejectRequest = useCallback(
    async (requestId: string, reason?: string) => {
      await handleRejectRef.current(requestId, reason)
    },
    [],
  )

  // No-op refs — Mingo agent has no RAG entity-card affordances.
  const discussRef = useCallback((_ref: ChatRef) => {
    /* no-op in Mingo mode */
  }, [])
  const displayRef = useCallback((_ref: ChatRef) => {
    /* no-op in Mingo mode */
  }, [])

  // ─── Return shape ─────────────────────────────────────────────────────────

  const { messages, streamingPhase, dialogTokenUsage = null, liveModel = null } = state
  const isLoading = streamingPhase !== 'idle'
  const hasMoreDialogs = dialogsNextCursor != null
  const hasMoreMessages = messagesNextCursor != null

  return useMemo<UnifiedChatState>(
    () => ({
      messages,
      isLoading,
      streamingPhase,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
      displayRef,
      // Model badge + token usage for the composer's `<ModelDisplay>`.
      // Model: live `metadata` frame → config baseline (host AI-config).
      // Tokens: live `token_usage` frame / dialog snapshot (`dialogTokenUsage`).
      // contextWindow uses the dialog's `contextSize` (the "X / Y" denominator,
      // matching the /mingo page). cacheHitRate/breakdown are SSE-only → null.
      currentProvider: liveModel?.provider ?? modelProvider ?? null,
      currentModelLabel: liveModel?.modelLabel ?? modelLabel ?? null,
      currentContextWindowMaxTokens:
        dialogTokenUsage?.contextSize ?? liveModel?.contextWindowMaxTokens ?? null,
      currentInputTokens: dialogTokenUsage?.inputTokensSize ?? null,
      currentOutputTokens: dialogTokenUsage?.outputTokensSize ?? null,
      currentCacheHitRatePct: null,
      currentUsageBreakdown: null,
      // Dialog management
      dialogs,
      activeDialogId: dialogId,
      selectDialog,
      startNewDialog,
      deleteDialog,
      renameDialog,
      archiveDialog,
      isDialogsLoading: isDialogsLoading || isCreatingDialog,
      dialogsError,
      reloadDialogs,
      isMessagesLoading,
      hasMoreDialogs,
      loadMoreDialogs,
      hasMoreMessages,
      loadMoreMessages,
      // Approval mutations
      approveRequest,
      rejectRequest,
      // Token usage
      dialogTokenUsage,
      // Connection state
      connectionState,
    }),
    [
      messages,
      isLoading,
      streamingPhase,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
      displayRef,
      dialogs,
      dialogId,
      selectDialog,
      startNewDialog,
      deleteDialog,
      renameDialog,
      archiveDialog,
      isDialogsLoading,
      dialogsError,
      reloadDialogs,
      isCreatingDialog,
      isMessagesLoading,
      hasMoreDialogs,
      loadMoreDialogs,
      hasMoreMessages,
      loadMoreMessages,
      approveRequest,
      rejectRequest,
      dialogTokenUsage,
      liveModel,
      modelProvider,
      modelLabel,
      connectionState,
    ],
  )
}
