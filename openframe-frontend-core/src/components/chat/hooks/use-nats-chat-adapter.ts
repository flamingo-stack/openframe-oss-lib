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
 *   │   onEvent → processChunk                                     │
 *   │            ↓                                                 │
 *   │ useRealtimeChunkProcessor   chunk → MessageSegment[]         │
 *   │            ↓                                                 │
 *   │   onSegmentsUpdate → updates assistant message in state      │
 *   │                                                              │
 *   │ useChunkCatchup             back-fill missed chunks after    │
 *   │                              activation / reconnect          │
 *   │                                                              │
 *   │ config.publishUserMessage   consumer-owned send (HTTP/NATS)  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Two operating modes, distinguished by the presence of `fetchDialogs`:
 *
 *   1. **Bare-transport mode** (current Tauri Fae Chat usage):
 *      consumer supplies `config.dialogId` explicitly and owns dialog
 *      management above the adapter. The adapter does no list/select
 *      bookkeeping — every dialog field on the return value falls back
 *      to an empty default. This is the original v0 API; preserved
 *      byte-compatible so existing pinned consumers keep working.
 *
 *   2. **Managed-dialog mode** (openframe-frontend, EmbeddableChat
 *      sidebar): consumer supplies `fetchDialogs`,
 *      `fetchDialogMessages`, `createDialog`, etc. and the adapter
 *      owns the dialog state machine. The active dialog id, the list,
 *      pagination cursors, token usage hydration, and history merge
 *      all live inside this hook. The host renders the sidebar via
 *      `EmbeddableChat`'s built-in `<ChatSidebar>` slot and calls
 *      `selectDialog` / `startNewDialog` from there.
 *
 * The two modes are NOT mutually exclusive — passing `config.dialogId`
 * alongside `fetchDialogs` forces the adapter into controlled mode (the
 * external id wins) while still using the host's list fetchers for the
 * sidebar.
 *
 * Why publish is consumer-owned: the NATS module exposes a low-level
 * `publishBytes/String/Json` but the actual user-message endpoint varies
 * by deployment (REST POST in some, NATS subject in others). The adapter
 * stays agnostic — caller wires up "user typed something, do X" via
 * the `publishUserMessage` callback.
 *
 * The `active` option gates the live subscription so the unified chat
 * shell can keep both adapters mounted while only paying network cost
 * for the currently-displayed mode.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { useNatsDialogSubscription } from './use-nats-dialog-subscription'
import { useRealtimeChunkProcessor } from './use-realtime-chunk-processor'
import { useChunkCatchup } from './use-chunk-catchup'
import { processHistoricalMessagesWithErrors } from '../utils/process-historical-messages'
import type {
  ChunkData,
  FetchChunksFunction,
  HistoricalMessage,
  MessageSegment,
  NatsMessageType,
  StreamingPhase,
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
   * Mirrors `UseRealtimeChunkProcessorOptions.batchApprovalsEnabled`.
   * Default `true` — single batch card per APPROVAL_REQUEST with
   * `toolCalls[]`. Set `false` to fall back to legacy per-tool cards.
   */
  batchApprovalsEnabled?: boolean

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
   * accumulator-compatible segments.
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
   * Approve a pending tool-call request. Wired into the segment
   * accumulator's `onApprove` so approval-card buttons fire this
   * directly. When omitted, approval cards render disabled buttons.
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
// Internal helpers
// =============================================================================

function nextId(role: 'user' | 'assistant'): string {
  // Date.now() + counter sliver keeps ids monotonic even when two
  // messages are produced inside the same ms tick (user + assistant
  // placeholder fire back-to-back from a single sendMessage call).
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Replace (or append) the trailing assistant message with the latest
 * accumulated segments. Mirrors the use-chat.ts pattern so render
 * behaviour matches the SSE adapter exactly.
 */
function updateTrailingAssistant(
  prev: UnifiedChatMessage[],
  segments: MessageSegment[],
): UnifiedChatMessage[] {
  const last = prev[prev.length - 1]
  if (!last || last.role !== 'assistant') {
    // No placeholder exists — append a fresh assistant message.
    return [
      ...prev,
      {
        id: nextId('assistant'),
        role: 'assistant',
        content: '',
        segments,
      },
    ]
  }
  return [
    ...prev.slice(0, -1),
    { ...last, segments },
  ]
}

/**
 * Map `ProcessedMessage` (lib's historical-message format) into
 * `UnifiedChatMessage` (the unified-chat-state contract). Only `user`
 * and `assistant` roles round-trip; `error` is dropped on the floor
 * here because the unified contract surfaces errors as banners, not
 * inline messages. (Hosts that need inline error bubbles can extend
 * the contract later.)
 */
function mapProcessedToUnified(
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

// =============================================================================
// Hook
// =============================================================================

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

  // ─── Message thread + streaming phase ─────────────────────────────────────

  const [messages, setMessages] = useState<UnifiedChatMessage[]>([])
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>('idle')

  // Approval status map. Used both to dedupe pending segments at render
  // time and to feed `processHistoricalMessagesWithErrors` so previously
  // resolved approvals don't re-render as actionable on dialog switch.
  const [approvalStatuses, setApprovalStatuses] = useState<
    Record<string, ChatApprovalStatus>
  >({})

  // ─── Dialog list state (managed-dialog mode only) ─────────────────────────

  const [dialogs, setDialogs] = useState<DialogItem[]>([])
  const [dialogsNextCursor, setDialogsNextCursor] = useState<string | null>(null)
  const [isDialogsLoading, setIsDialogsLoading] = useState<boolean>(false)
  const [dialogsError, setDialogsError] = useState<boolean>(false)
  const [isCreatingDialog, setIsCreatingDialog] = useState<boolean>(false)

  // ─── Message-history pagination ───────────────────────────────────────────

  const [messagesNextCursor, setMessagesNextCursor] = useState<string | null>(null)
  const [isMessagesLoading, setIsMessagesLoading] = useState<boolean>(false)

  // ─── Token usage (Mingo per-dialog cumulative) ────────────────────────────

  const [dialogTokenUsage, setDialogTokenUsage] = useState<DialogTokenUsage | null>(
    null,
  )

  // ─── Live model metadata (from streaming `metadata` frames) ───────────────
  // Refines the composer's model badge per-turn. Falls back to the config
  // baseline (`modelProvider`/`modelLabel`) until the first frame lands.
  const [liveModel, setLiveModel] = useState<{
    provider: string | null
    modelLabel: string | null
    contextWindowMaxTokens: number | null
  } | null>(null)

  // ─── Connection state ─────────────────────────────────────────────────────

  const [connectionState, setConnectionState] =
    useState<ChatConnectionState>('connecting')

  // ─── Approval handlers ────────────────────────────────────────────────────
  // Optimistically flip status before the network round-trip so the
  // accumulator's render reflects the user's choice immediately.

  const handleApprove = useCallback(
    async (requestId: string) => {
      if (!approveRequestCallback) return
      setApprovalStatuses((prev) => ({ ...prev, [requestId]: 'approved' }))
      try {
        await approveRequestCallback(requestId)
      } catch (err) {
        // Revert the optimistic flip on failure so the user can retry.
        setApprovalStatuses((prev) => {
          const next = { ...prev }
          delete next[requestId]
          return next
        })
        console.error('[useNatsChatAdapter] approveRequest failed:', err)
      }
    },
    [approveRequestCallback],
  )

  const handleReject = useCallback(
    async (requestId: string, reason?: string) => {
      if (!rejectRequestCallback) return
      setApprovalStatuses((prev) => ({ ...prev, [requestId]: 'rejected' }))
      try {
        await rejectRequestCallback(requestId, reason)
      } catch (err) {
        setApprovalStatuses((prev) => {
          const next = { ...prev }
          delete next[requestId]
          return next
        })
        console.error('[useNatsChatAdapter] rejectRequest failed:', err)
      }
    },
    [rejectRequestCallback],
  )

  // Stable refs so the accumulator's callbacks don't churn on re-render.
  const handleApproveRef = useRef(handleApprove)
  handleApproveRef.current = handleApprove
  const handleRejectRef = useRef(handleReject)
  handleRejectRef.current = handleReject

  // Accumulator-compatible adapters. The lib's accumulator contract is
  // `(requestId?: string) => void | Promise<void>` — single optional arg,
  // no rejection reason. Our public API surface widens that to require a
  // string + accept a reason, so we narrow here at the boundary. Reason
  // is unavailable from button-click callers (the accumulator doesn't
  // pass it) so we only forward the requestId; consumers that need
  // structured reject reasons can call `rejectRequest` directly.
  const accumApprove = useCallback((requestId?: string): void | Promise<void> => {
    if (!requestId) return
    return handleApproveRef.current(requestId)
  }, [])
  const accumReject = useCallback((requestId?: string): void | Promise<void> => {
    if (!requestId) return
    return handleRejectRef.current(requestId)
  }, [])

  // Stable callback ref so `useRealtimeChunkProcessor`'s options object
  // doesn't churn every render and tear down the accumulator state.
  const callbacksRef: MutableRefObject<{
    onSegmentsUpdate: (segments: MessageSegment[]) => void
    onStreamStart: () => void
    onStreamEnd: () => void
    onTokenUsage: (data: DialogTokenUsage) => void
    onMetadata: (meta: {
      modelDisplayName?: string
      modelName: string
      providerName: string
      contextWindow: number
    }) => void
  }> = useRef({
    onSegmentsUpdate: (segments: MessageSegment[]) => {
      setMessages((prev) => updateTrailingAssistant(prev, segments))
    },
    onStreamStart: () => setStreamingPhase('streaming'),
    onStreamEnd: () => setStreamingPhase('idle'),
    // Live cumulative token counter for the active dialog — drives the
    // composer's "X / Y tokens used" tail as the assistant streams.
    onTokenUsage: (data: DialogTokenUsage) => setDialogTokenUsage(data),
    // Per-turn model badge (provider/label/context window).
    onMetadata: (meta) =>
      setLiveModel({
        provider: meta.providerName || null,
        modelLabel: meta.modelDisplayName || meta.modelName || null,
        contextWindowMaxTokens: meta.contextWindow || null,
      }),
  })

  // Real-time chunk → segment processor. Approval handlers route through
  // the refs so a config change (e.g. callback identity churn from the
  // host) doesn't tear down the accumulator.
  const { processChunk, reset: resetAccumulator } = useRealtimeChunkProcessor({
    callbacks: {
      onSegmentsUpdate: (segments) => callbacksRef.current.onSegmentsUpdate(segments),
      onStreamStart: () => callbacksRef.current.onStreamStart(),
      onStreamEnd: () => callbacksRef.current.onStreamEnd(),
      onTokenUsage: (data) => callbacksRef.current.onTokenUsage(data),
      onMetadata: (meta) => callbacksRef.current.onMetadata(meta),
      onApprove: accumApprove,
      onReject: accumReject,
    },
    batchApprovalsEnabled,
  })

  // History catchup — back-fills chunks emitted while the adapter was
  // inactive or before the WS came online.
  const {
    processChunk: catchupProcessChunk,
    catchUpChunks,
    startInitialBuffering,
    resetChunkTracking,
  } = useChunkCatchup({
    dialogId: active ? dialogId : null,
    onChunkReceived: (chunk: ChunkData) => processChunk(chunk),
    fetchChunks,
  })

  // ─── Historical message hydration ─────────────────────────────────────────
  // When the active dialog changes AND a `fetchDialogMessages` callback
  // is wired, load the first page of history, process it through the
  // accumulator, and seed `messages`. Streaming chunks for the same
  // dialog then append on top.

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
            approvalStatuses,
            batchApprovalsEnabled,
          },
        )
        const unified = mapProcessedToUnified(rawProcessed)
        if (cursor === undefined) {
          // First page — replace.
          setMessages(unified)
        } else {
          // Older page — prepend.
          setMessages((prev) => [...unified, ...prev])
        }
        setMessagesNextCursor(result.nextCursor)
        if (result.tokenUsage !== undefined) {
          setDialogTokenUsage(result.tokenUsage)
        }
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
      approvalStatuses,
      batchApprovalsEnabled,
      accumApprove,
      accumReject,
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

    // Drop accumulator + message state for the previous dialog.
    resetAccumulator()
    setMessages([])
    setMessagesNextCursor(null)
    setDialogTokenUsage(null)
    // Clear per-dialog live model metadata too — otherwise the composer briefly
    // shows the previous dialog's provider/model until the next chunk streams.
    setLiveModel(null)
    setStreamingPhase('idle')
    // No load runs when there's no active dialog, so clear the flag here;
    // otherwise the superseded load's guarded `finally` leaves it stuck on.
    setIsMessagesLoading(false)

    if (!active || !dialogId) return

    // Hydrate history first; then catchup will fold in any chunks that
    // landed between the history snapshot and the live tail.
    void loadDialogHistory(dialogId)
  }, [active, dialogId, loadDialogHistory, resetAccumulator])

  // Trigger initial chunk backfill whenever a fresh dialog activates.
  // Runs alongside history hydration — history seeds processed messages,
  // catchup buffers raw chunks in case the WS came online after history
  // was already snapshotted.
  useEffect(() => {
    if (!active || !dialogId) return
    resetChunkTracking()
    startInitialBuffering()
    catchUpChunks().catch((err) => {
      console.error('[useNatsChatAdapter] initial catchup failed:', err)
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
      // placeholder. The assistant body fills in as NATS chunks land.
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('user'),
          role: 'user',
          content: text,
          ...(hidden ? { hidden: true } : {}),
        },
        {
          id: nextId('assistant'),
          role: 'assistant',
          content: '',
          segments: [],
        },
      ])
      setStreamingPhase('thinking')

      await publishUserMessage(text, { hidden, dialogId })
    },
    [publishUserMessage, dialogId],
  )

  const stopMessage = useCallback(() => {
    // Best-effort UI flip. The actual backend cancellation is gated on
    // the host-supplied callback.
    setStreamingPhase('idle')
    if (stopGenerationCallback && dialogId) {
      void stopGenerationCallback(dialogId).catch((err) => {
        console.error('[useNatsChatAdapter] stopGeneration failed:', err)
      })
    }
  }, [stopGenerationCallback, dialogId])

  const clearMessages = useCallback(() => {
    setMessages([])
    resetAccumulator()
    setStreamingPhase('idle')
  }, [resetAccumulator])

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
