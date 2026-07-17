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
import { extractIncompleteMessageState } from '../utils/extract-incomplete-message-state'
import type {
  ChunkData,
  FetchChunksFunction,
  HistoricalMessage,
  MessageProcessingOptions,
  MessageSegment,
  NatsMessageType,
  StreamingPhase,
  ChatApprovalStatus,
  SegmentsUpdateMetadata,
  ToolExecutionSegment,
  ApprovalBatchExecutionState,
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

  /**
   * Approval types rendered as actionable cards inline. Mirrors
   * `UseRealtimeChunkProcessorOptions.displayApprovalTypes` (default
   * `['CLIENT']`) and is forwarded to the history processor so both paths
   * agree. Hosts whose backend emits other types (e.g. `USER`) MUST set this
   * — otherwise those approvals are escalated to a callback this adapter
   * doesn't surface and the card never renders.
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
 * Realtime user/direct/system chunks can be replays of rows already on
 * screen (our own optimistic send echoed back, catchup replaying the tail
 * over just-loaded history, reconnect back-fill).
 *
 * Dedup layers, in priority order:
 *  1. `streamSeq` identity (JetStream) — exact, never confuses a genuinely
 *     repeated text with a replay; tracked in a per-dialog seen-set.
 *  2. One-shot optimistic-echo consumption — `sendMessage` records the text
 *     it optimistically rendered; the backend's MESSAGE_REQUEST echo removes
 *     exactly one entry.
 *  3. Content match over a SHORT same-author tail window — only for
 *     seq-less transports (plain NATS replay over just-loaded history, where
 *     the persisted twin sits at most a couple of rows up). Same-author so
 *     an admin message can never suppress a user's identical text.
 */
const CONTENT_DEDUP_WINDOW = 4
const SYSTEM_DEDUP_WINDOW = 10

function hasRecentMessage(
  prev: UnifiedChatMessage[],
  predicate: (message: UnifiedChatMessage) => boolean,
  window: number,
): boolean {
  const start = Math.max(0, prev.length - window)
  for (let i = prev.length - 1; i >= start; i--) {
    if (predicate(prev[i])) return true
  }
  return false
}

/**
 * Append-mode counterpart of `updateTrailingAssistant` for post-MESSAGE_END
 * continuation chunks (`SegmentsUpdateMetadata.append`). The processor emits
 * single text/thinking fragments there — replacing the bubble with them (the
 * old behaviour, which dropped the metadata) wiped everything the bubble
 * already showed. Coalesces trailing fragments of the same type, mirroring
 * the accumulator.
 *
 * Exported for host reuse (custom stores wiring the same processor) + tests.
 */
export function appendToTrailingAssistant(
  prev: UnifiedChatMessage[],
  segments: MessageSegment[],
): UnifiedChatMessage[] {
  if (segments.length === 0) return prev
  const last = prev[prev.length - 1]
  if (!last || last.role !== 'assistant') {
    return [
      ...prev,
      { id: nextId('assistant'), role: 'assistant', content: '', segments },
    ]
  }
  const merged = [...(last.segments ?? [])]
  for (const seg of segments) {
    const tail = merged[merged.length - 1]
    if (seg.type === 'text' && tail?.type === 'text') {
      merged[merged.length - 1] = { type: 'text', text: tail.text + seg.text }
    } else if (seg.type === 'thinking' && tail?.type === 'thinking') {
      merged[merged.length - 1] = { type: 'thinking', text: tail.text + seg.text }
    } else if (seg.type === 'approval_batch') {
      // Approval deltas must be IDEMPOTENT: the escalated-result emit can be
      // seen twice (live + catch-up replay over hydrated history), so upsert
      // by request id instead of raw-appending a duplicate card.
      const idx = merged.findIndex(
        (m) => m.type === 'approval_batch' && m.data.approvalRequestId === seg.data.approvalRequestId,
      )
      if (idx !== -1) merged[idx] = seg
      else merged.push(seg)
    } else if (seg.type === 'approval_request') {
      // Legacy cards share one requestId across an unfolded batch — key on
      // (requestId, command) so each tool's card upserts its own twin.
      const idx = merged.findIndex(
        (m) =>
          m.type === 'approval_request' &&
          m.data.requestId === seg.data.requestId &&
          m.data.command === seg.data.command,
      )
      if (idx !== -1) merged[idx] = seg
      else merged.push(seg)
    } else {
      // Other non-text segments are pushed RAW on purpose: EXECUTING↔EXECUTED
      // pairing and batch merging are `applyToolExecutionToMessages`'s job
      // (post-END tool chunks never reach this helper — the processor routes
      // them to onToolExecuted). Running the accumulator here would
      // double-apply those rules.
      merged.push(seg)
    }
  }
  return [...prev.slice(0, -1), { ...last, segments: merged }]
}

/**
 * Upsert a standalone context-compaction segment into the trailing assistant
 * bubble. Compaction emissions arrive as the accumulator's CUMULATIVE array —
 * only the compaction segment itself may be applied, or interleaved
 * continuation text would duplicate. A `completed` segment replaces the last
 * `started` one in place.
 *
 * Exported for host reuse + tests.
 */
export function upsertTrailingCompaction(
  prev: UnifiedChatMessage[],
  segments: MessageSegment[],
): UnifiedChatMessage[] {
  const compaction = [...segments].reverse().find((s) => s.type === 'context_compaction')
  if (!compaction) return prev
  const last = prev[prev.length - 1]
  if (!last || last.role !== 'assistant') {
    return [
      ...prev,
      { id: nextId('assistant'), role: 'assistant', content: '', segments: [compaction] },
    ]
  }
  const existing = last.segments ?? []
  // LAST 'started' segment (not first): with repeated compactions in one
  // bubble the earlier ones are already completed-in-place, so the newest
  // 'started' is the only one this completion can belong to.
  const startedIdx = existing.map((s) => s.type === 'context_compaction' && s.status === 'started').lastIndexOf(true)
  const merged =
    startedIdx !== -1
      ? existing.map((s, i) => (i === startedIdx ? compaction : s))
      : [...existing, compaction]
  return [...prev.slice(0, -1), { ...last, segments: merged }]
}

/**
 * Cross-message tool-execution updater for post-MESSAGE_END tool chunks
 * (approved commands executing after the approval bubble, async batch
 * results). Scans messages from the end:
 *  1) an `approval_batch` whose `toolCalls` contains the execution id →
 *     merge into its `executions` map;
 *  2) a matching `tool_execution` segment (same id, or EXECUTING with the
 *     same tool for legacy id-less backends) → update in place;
 *  3) no match → append the segment to the trailing assistant bubble.
 *
 * Exported for host reuse + tests.
 */
export function applyToolExecutionToMessages(
  prev: UnifiedChatMessage[],
  segment: ToolExecutionSegment,
): UnifiedChatMessage[] {
  const toolData = segment.data
  const execId = toolData.toolExecutionRequestId

  for (let i = prev.length - 1; i >= 0; i--) {
    const message = prev[i]
    if (message.role !== 'assistant' || !message.segments) continue

    for (let j = message.segments.length - 1; j >= 0; j--) {
      const seg = message.segments[j]

      if (
        execId &&
        seg.type === 'approval_batch' &&
        seg.data.toolCalls.some((c) => c.toolExecutionRequestId === execId)
      ) {
        const prevExec: ApprovalBatchExecutionState | undefined = seg.data.executions?.[execId]
        // Never downgrade a done batch slot back to executing (JetStream
        // redelivery of the EXECUTING chunk after EXECUTED landed). Returning
        // prev = matched-with-no-change, so the caller doesn't append either.
        if (toolData.type === 'EXECUTING_TOOL' && prevExec?.status === 'done') {
          return prev
        }
        const nextExec: ApprovalBatchExecutionState =
          toolData.type === 'EXECUTED_TOOL'
            ? { status: 'done', result: toolData.result, success: toolData.success }
            : { status: 'executing', result: prevExec?.result, success: prevExec?.success }
        const nextSegments = [...message.segments]
        nextSegments[j] = {
          ...seg,
          data: { ...seg.data, executions: { ...(seg.data.executions ?? {}), [execId]: nextExec } },
        }
        const next = [...prev]
        next[i] = { ...message, segments: nextSegments }
        return next
      }

      if (seg.type === 'tool_execution') {
        // KNOWN LIMIT (id-less chunks only — current backends always send
        // toolExecutionRequestId): the fuzzy fallback pairs only with a
        // segment still EXECUTING, so a replayed id-less EXECUTING/EXECUTED
        // arriving after the pair completed matches nothing and falls to the
        // append below (duplicate card). Widening the predicate to EXECUTED
        // twins would instead swallow a LEGITIMATE second run of the same
        // tool — without ids the two are indistinguishable, and losing a
        // real run is worse than a duplicate card on a legacy transport.
        const matches = execId
          ? seg.data.toolExecutionRequestId === execId
          : seg.data.type === 'EXECUTING_TOOL' &&
            seg.data.integratedToolType === toolData.integratedToolType &&
            seg.data.toolFunction === toolData.toolFunction
        if (!matches) continue
        // Never downgrade a completed segment back to EXECUTING (replayed
        // EXECUTING chunk after its EXECUTED already landed).
        if (toolData.type === 'EXECUTING_TOOL' && seg.data.type === 'EXECUTED_TOOL') {
          return prev
        }
        const nextSegments = [...message.segments]
        nextSegments[j] = {
          type: 'tool_execution',
          data: {
            ...toolData,
            toolTitle: toolData.toolTitle ?? seg.data.toolTitle,
            parameters: toolData.parameters || seg.data.parameters,
          },
        }
        const next = [...prev]
        next[i] = { ...message, segments: nextSegments }
        return next
      }
    }
  }

  return appendToTrailingAssistant(prev, [segment])
}

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

  // ─── Message thread + streaming phase ─────────────────────────────────────

  const [messages, setMessages] = useState<UnifiedChatMessage[]>([])
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>('idle')
  // Live mirror for click handlers that must read the CURRENT phase without
  // re-creating on every phase change (handleApprove's scoped revert).
  const streamingPhaseRef = useRef(streamingPhase)
  streamingPhaseRef.current = streamingPhase
  // Gate: suppress onAgentBusy while the initial catchup replays historical
  // chunks. A dead tail (approval approved / tool started, then Stop or a
  // crash — no continuation ever persisted) replays its APPROVAL_RESULT /
  // EXECUTING_TOOL chunks on every dialog (re)open, and the releasing
  // MESSAGE_END never replays — locking the composer forever. Live chunks
  // after catchup lock normally; a reopened mid-execution dialog re-locks on
  // the next live chunk instead.
  // A COUNTER, not a boolean: the initial-catchup window and a reconnect
  // back-fill window can overlap (reconnect during the initial fetch), and
  // with a boolean whichever finished FIRST dropped the other's suppression
  // mid-replay. Each window increments on entry / decrements in its finally.
  const suppressAgentBusyRef = useRef(0)

  // True when the trailing assistant loaded from history is an INCOMPLETE
  // turn (mid-stream / mid-approval tail). The catchup replay re-streams that
  // turn from its MESSAGE_START, and the replayed stream must ADOPT (replace)
  // the partial history bubble. Any other MESSAGE_START over a non-empty
  // trailing assistant is a NEW turn (observer / second device / post-approval
  // continuation) and must open a fresh bubble instead of overwriting the
  // completed one. Consumed (reset) by the first MESSAGE_START.
  const adoptTrailingAssistantRef = useRef(false)

  // Set after the first successful NATS connect. Later 'connected' events are
  // RECONNECTS: plain NATS replays nothing, so the adapter must back-fill the
  // disconnect gap via `resetAndCatchUp` or those chunks are lost forever.
  const hasConnectedOnceRef = useRef(false)

  // Exact-identity dedup for participant chunks (user/direct/system): the
  // JetStream streamSeq of every rendered participant row. Cleared per
  // dialog. See the dedup-layers note above `hasRecentMessage`.
  const seenParticipantSeqsRef = useRef<Set<number>>(new Set())
  // Texts `sendMessage` rendered optimistically and whose MESSAGE_REQUEST
  // echo hasn't come back yet — the echo consumes exactly ONE entry, so a
  // genuinely repeated send ("yes", "yes") still renders twice.
  const pendingEchoTextsRef = useRef<string[]>([])

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
      // Approval hands the turn back to the agent — lock the composer now
      // rather than waiting for the APPROVAL_RESULT/EXECUTING_TOOL chunks.
      // Remember whether THIS click took the lock: if the phase was already
      // busy (another approval's command executing), a failure of this
      // request must not release a lock it doesn't own.
      const tookLock = streamingPhaseRef.current === 'idle'
      setStreamingPhase((p) => (p === 'idle' ? 'thinking' : p))
      try {
        await approveRequestCallback(requestId)
      } catch (err) {
        // Revert the optimistic flip on failure so the user can retry.
        setApprovalStatuses((prev) => {
          const next = { ...prev }
          delete next[requestId]
          return next
        })
        if (tookLock) {
          setStreamingPhase((p) => (p === 'thinking' ? 'idle' : p))
        }
        console.error('[useNatsChatAdapter] approveRequest failed:', err)
      }
    },
    [approveRequestCallback],
  )

  const handleReject = useCallback(
    async (requestId: string, reason?: string) => {
      if (!rejectRequestCallback) return
      // Deliberately NO phase lock here (asymmetric with handleApprove):
      // rejection keeps the composer free so the user can type a correction
      // right away — see the matching `approved`-only onAgentBusy guard in
      // use-realtime-chunk-processor's approval_result case. If the agent
      // does stream an acknowledgment, MESSAGE_START locks the composer then.
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
    onSegmentsUpdate: (segments: MessageSegment[], meta?: SegmentsUpdateMetadata) => void
    onStreamStart: () => void
    onStreamEnd: () => void
    onAgentBusy: () => void
    onError: () => void
    onTokenUsage: (data: DialogTokenUsage) => void
    onMetadata: (meta: {
      modelDisplayName?: string
      modelName: string
      providerName: string
      contextWindow: number
    }) => void
    onToolExecuted: (segment: ToolExecutionSegment) => void
    onApprovalResolved: (
      requestId: string,
      status: ChatApprovalStatus,
      approvalType: string,
      resolvedByName?: string | null,
    ) => void
    onUserMessage: (
      text: string,
      meta?: { ownerType?: string; displayName?: string; userId?: string; streamSeq?: number; contextItems?: Array<{ type: string; id: string }> },
    ) => void
    onDirectMessage: (
      text: string,
      meta?: { ownerType?: string; displayName?: string; userId?: string; streamSeq?: number },
    ) => void
    onSystemMessage: (text: string, meta?: { streamSeq?: number }) => void
  }> = useRef({
    onSegmentsUpdate: (segments: MessageSegment[], meta?: SegmentsUpdateMetadata) => {
      // Standalone compaction updates carry the accumulator's cumulative
      // array — apply only the compaction segment (upsert) or interleaved
      // continuation text would duplicate.
      if (meta?.append && meta.isCompacting) {
        setMessages((prev) => upsertTrailingCompaction(prev, segments))
        return
      }
      // Post-MESSAGE_END continuation fragments append into the existing
      // bubble; replacing (the pre-fix behaviour, which dropped `meta`)
      // wiped the completed reply and left only the newest fragment.
      if (meta?.append) {
        setMessages((prev) => appendToTrailingAssistant(prev, segments))
        return
      }
      setMessages((prev) => updateTrailingAssistant(prev, segments))
    },
    onStreamStart: () => {
      setStreamingPhase('streaming')
      // A new stream must never overwrite a COMPLETED trailing assistant
      // bubble (observer tab / second device / post-approval continuation
      // turn). Open a fresh bubble unless the trailing assistant is empty
      // (our own optimistic placeholder) or is the incomplete history tail
      // the catchup replay is legitimately re-streaming (adopt-once flag).
      const adoptTail = adoptTrailingAssistantRef.current
      adoptTrailingAssistantRef.current = false
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant' || adoptTail) return prev
        const hasContent = (last.segments?.length ?? 0) > 0 || last.content !== ''
        if (!hasContent) return prev
        return [
          ...prev,
          { id: nextId('assistant'), role: 'assistant', content: '', segments: [] },
        ]
      })
    },
    onStreamEnd: () => setStreamingPhase('idle'),
    // Agent is executing (approved) commands outside an open stream — keep
    // the composer locked exactly like the in-stream phases. An open stream
    // keeps ownership: only 'idle' upgrades to 'thinking'. Suppressed during
    // initial catchup so a replayed dead tail can't lock a finished dialog.
    onAgentBusy: () => {
      if (suppressAgentBusyRef.current > 0) return
      setStreamingPhase((p) => (p === 'idle' ? 'thinking' : p))
    },
    // Terminal turn failures can arrive without a MESSAGE_END; unlock the
    // composer unless an open stream still owns the phase (in-stream errors
    // are followed by the stream's own MESSAGE_END).
    onError: () => setStreamingPhase((p) => (p === 'streaming' ? p : 'idle')),
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
    // Post-MESSAGE_END tool chunks (approved commands executing after the
    // approval bubble, async batch results). Routed through the cross-message
    // updater — the accumulator was reset at MESSAGE_END, so the old
    // fallthrough replaced the whole trailing bubble with one tool segment.
    onToolExecuted: (segment: ToolExecutionSegment) => {
      setMessages((prev) => applyToolExecutionToMessages(prev, segment))
    },
    // Cross-message approval status flip. Wiring this also makes the
    // processor skip its cumulative re-emit for resolved approvals — which,
    // post-MESSAGE_END, was an empty array that blanked the trailing bubble.
    onApprovalResolved: (requestId, status, _approvalType, resolvedByName) => {
      setMessages((prev) => {
        let changed = false
        const next = prev.map((m) => {
          if (m.role !== 'assistant' || !m.segments) return m
          let msgChanged = false
          const segs = m.segments.map((s) => {
            if (s.type === 'approval_request' && s.data.requestId === requestId && s.status !== status) {
              msgChanged = true
              return { ...s, status }
            }
            if (s.type === 'approval_batch' && s.data.approvalRequestId === requestId) {
              const nextResolvedBy = resolvedByName ?? s.resolvedByName
              if (s.status === status && nextResolvedBy === s.resolvedByName) return s
              msgChanged = true
              return { ...s, status, resolvedByName: nextResolvedBy }
            }
            return s
          })
          if (!msgChanged) return m
          changed = true
          return { ...m, segments: segs }
        })
        return changed ? next : prev
      })
      // Mirror into the status map so history re-processing (dialog reopen,
      // pagination) renders the card resolved instead of actionable.
      setApprovalStatuses((prev) =>
        prev[requestId] === status ? prev : { ...prev, [requestId]: status },
      )
    },
    // MESSAGE_REQUEST echo — a user message from THIS or another session.
    onUserMessage: (text, meta) => {
      if (!text) return
      // Layer 1 FIRST: exact event identity. A seq we've handled is a
      // replay; a fresh seq is appended with NO content matching, so
      // genuinely repeated texts from other participants always render.
      // Must run (and RECORD) before the echo consume below — the echo
      // branch early-returns, and skipping the record there let an
      // at-least-once redelivery of the same event pass as fresh (and eat
      // a second pending echo entry).
      const seq = meta?.streamSeq
      if (typeof seq === 'number') {
        if (seenParticipantSeqsRef.current.has(seq)) return
        seenParticipantSeqsRef.current.add(seq)
      }
      // Layer 2: our own optimistic echo — consume exactly one recorded send.
      if (meta?.ownerType !== 'ADMIN') {
        const echoIdx = pendingEchoTextsRef.current.indexOf(text)
        if (echoIdx !== -1) {
          pendingEchoTextsRef.current.splice(echoIdx, 1)
          return
        }
      }
      const authorType = meta?.ownerType === 'ADMIN' ? 'admin' : 'user'
      setMessages((prev) => {
        // Layer 3: seq-less transports only — same-author content twin in the
        // immediate tail (replay over just-loaded history).
        if (
          typeof seq !== 'number' &&
          hasRecentMessage(
            prev,
            (m) => m.role === 'user' && (m.authorType ?? 'user') === authorType && m.content === text,
            CONTENT_DEDUP_WINDOW,
          )
        ) {
          return prev
        }
        return [
          ...prev,
          {
            id: nextId('user'),
            role: 'user',
            content: text,
            ...(meta?.displayName ? { name: meta.displayName } : {}),
            authorType,
            ...(meta?.contextItems && meta.contextItems.length > 0
              ? {
                  contextItems: meta.contextItems.map((ci) => ({
                    type: ci.type,
                    id: ci.id,
                    label: (ci as { label?: string }).label ?? ci.id,
                  })),
                }
              : {}),
          },
        ]
      })
    },
    // Technician / admin direct message into the dialog.
    onDirectMessage: (text, meta) => {
      if (!text) return
      const seq = meta?.streamSeq
      if (typeof seq === 'number') {
        if (seenParticipantSeqsRef.current.has(seq)) return
        seenParticipantSeqsRef.current.add(seq)
      }
      setMessages((prev) => {
        // Seq-less fallback matches only prior ADMIN-authored twins — a
        // client's identical text must never suppress the technician's.
        if (
          typeof seq !== 'number' &&
          hasRecentMessage(
            prev,
            (m) => m.role === 'user' && m.authorType === 'admin' && m.content === text,
            CONTENT_DEDUP_WINDOW,
          )
        ) {
          return prev
        }
        return [
          ...prev,
          {
            id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: 'user',
            content: text,
            name: meta?.displayName ?? 'Admin',
            authorType: 'admin',
          },
        ]
      })
    },
    // System notice — rendered as a name-only row (same shape the history
    // processor produces via `pushStandaloneMessages`).
    onSystemMessage: (text, meta) => {
      if (!text) return
      const seq = meta?.streamSeq
      if (typeof seq === 'number') {
        if (seenParticipantSeqsRef.current.has(seq)) return
        seenParticipantSeqsRef.current.add(seq)
      }
      setMessages((prev) => {
        if (
          typeof seq !== 'number' &&
          hasRecentMessage(prev, (m) => m.authorType === 'system' && m.name === text, SYSTEM_DEDUP_WINDOW)
        ) {
          return prev
        }
        return [
          ...prev,
          {
            id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: 'user',
            content: '',
            name: text,
            authorType: 'system',
          },
        ]
      })
    },
  })

  // Real-time chunk → segment processor. Approval handlers route through
  // the refs so a config change (e.g. callback identity churn from the
  // host) doesn't tear down the accumulator.
  const { processChunk, reset: resetAccumulator } = useRealtimeChunkProcessor({
    callbacks: {
      onSegmentsUpdate: (segments, meta) => callbacksRef.current.onSegmentsUpdate(segments, meta),
      onStreamStart: () => callbacksRef.current.onStreamStart(),
      onStreamEnd: () => callbacksRef.current.onStreamEnd(),
      onAgentBusy: () => callbacksRef.current.onAgentBusy(),
      onError: () => callbacksRef.current.onError(),
      onTokenUsage: (data) => callbacksRef.current.onTokenUsage(data),
      onMetadata: (meta) => callbacksRef.current.onMetadata(meta),
      onToolExecuted: (segment) => callbacksRef.current.onToolExecuted(segment),
      onApprovalResolved: (requestId, status, approvalType, resolvedByName) =>
        callbacksRef.current.onApprovalResolved(requestId, status, approvalType, resolvedByName),
      onUserMessage: (text, meta) => callbacksRef.current.onUserMessage(text, meta),
      onDirectMessage: (text, meta) => callbacksRef.current.onDirectMessage(text, meta),
      onSystemMessage: (text, meta) => callbacksRef.current.onSystemMessage(text, meta),
      onApprove: accumApprove,
      onReject: accumReject,
    },
    batchApprovalsEnabled,
    approvalStatuses,
    ...(displayApprovalTypes ? { displayApprovalTypes } : {}),
  })

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
            ...(displayApprovalTypes ? { displayApprovalTypes } : {}),
          },
        )
        const unified = mapProcessedToUnified(rawProcessed)
        if (cursor === undefined) {
          // First page — replace. When the trailing assistant is an
          // INCOMPLETE turn, the catchup replay will re-stream it from its
          // MESSAGE_START — let that stream adopt (replace) the partial
          // bubble instead of opening a duplicate one.
          // Gated on an ACTIVE catchup buffer: when the catchup already
          // finalized before this history page resolved, no replay is coming
          // to consume the flag — arming it anyway would hand the adoption
          // to the NEXT genuine turn, which would overwrite the partial
          // bubble instead of opening a fresh one.
          adoptTrailingAssistantRef.current =
            isBufferingActive() &&
            extractIncompleteMessageState(rawProcessed[rawProcessed.length - 1]) !== undefined
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

    // Drop accumulator + message state for the previous dialog.
    resetAccumulator()
    adoptTrailingAssistantRef.current = false
    seenParticipantSeqsRef.current.clear()
    pendingEchoTextsRef.current = []
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
    // Gate onAgentBusy for the replay window (see suppressAgentBusyRef).
    suppressAgentBusyRef.current += 1
    resetChunkTracking()
    startInitialBuffering()
    catchUpChunks()
      .catch((err) => {
        console.error('[useNatsChatAdapter] initial catchup failed:', err)
      })
      .finally(() => {
        suppressAgentBusyRef.current = Math.max(0, suppressAgentBusyRef.current - 1)
        // The adopt-once flag targets the replayed MESSAGE_START of the
        // incomplete history tail. When the replay produced none (chunk
        // store expired past its ~10-min retention / empty), the armed flag
        // would survive and make the NEXT genuine turn (post-approval
        // continuation, second device) adopt-and-overwrite the partial
        // bubble. Scoped: only the still-active dialog clears its own flag.
        if (dialogId === currentDialogIdRef.current) {
          adoptTrailingAssistantRef.current = false
        }
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
      suppressAgentBusyRef.current += 1
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
          if (dialogId && fetchDialogMessages) {
            await loadDialogHistory(dialogId)
          }
          // The user may have switched dialogs during the await — the new
          // dialog's own effects run their catchup cycle; re-running it here
          // (via refs it would target the NEW dialog) would reset that cycle
          // mid-flight.
          if (dialogId !== currentDialogIdRef.current) return
          await resetAndCatchUp()
        } catch (err) {
          console.error('[useNatsChatAdapter] reconnect catchup failed:', err)
        } finally {
          suppressAgentBusyRef.current = Math.max(0, suppressAgentBusyRef.current - 1)
          // The adopt-once flag targets the replayed MESSAGE_START of the
          // incomplete tail — but on reconnect that START was already
          // consumed live and is dedup-skipped by the replay, so it never
          // fires onStreamStart. Clear the flag or the NEXT genuine turn
          // adopts (and overwrites) the completed trailing bubble. Scoped:
          // a stale back-fill must not clear the NEW dialog's freshly armed
          // flag.
          if (dialogId === currentDialogIdRef.current) {
            adoptTrailingAssistantRef.current = false
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

      // Record the text so the backend's MESSAGE_REQUEST echo consumes this
      // send instead of rendering a duplicate row (cap keeps the list from
      // growing if a backend never echoes).
      pendingEchoTextsRef.current.push(text)
      if (pendingEchoTextsRef.current.length > 5) pendingEchoTextsRef.current.shift()

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
