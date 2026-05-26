'use client'

/**
 * useNatsChatAdapter — the NATS/Mingo-mode transport adapter for the
 * unified chat surface. Companion of `useSseChatAdapter` (Guide mode);
 * both implement the same `UnifiedChatState` contract so the public
 * `useChat({ mode })` can dispatch between them with zero shell-side
 * branching.
 *
 * Composition (no new logic — all the pieces already exist in the lib):
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
import type {
  ChunkData,
  FetchChunksFunction,
  MessageSegment,
  NatsMessageType,
  StreamingPhase,
} from '../types'
import type {
  UnifiedChatState,
  UnifiedChatMessage,
  UnifiedSendMessageOptions,
} from '../types/unified-chat-state.types'
import type { ChatRef } from '../chat-ref.types'

// =============================================================================
// Config + options
// =============================================================================

/**
 * Consumer-supplied configuration for the NATS chat adapter.
 *
 * Every field is consumer-owned — the lib does not assume a particular
 * backend protocol or auth scheme. Hosts wire these up against their
 * own OpenFrame deployment.
 */
export interface UseNatsChatAdapterConfig {
  /**
   * Active conversation/dialog id. When `null` the adapter stays
   * subscription-idle (no NATS connection, no catchup fetch). Set this
   * once the consumer's "open new conversation" flow has allocated an
   * id from the backend.
   */
  dialogId: string | null

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
   * Whether THINKING chunks are surfaced as segments. Default `false`
   * (parity with the existing `useRealtimeChunkProcessor` default).
   */
  enableThinking?: boolean

  /**
   * Mirrors `UseRealtimeChunkProcessorOptions.batchApprovalsEnabled`.
   * Default `true` — single batch card per APPROVAL_REQUEST with
   * `toolCalls[]`. Set `false` to fall back to legacy per-tool cards.
   */
  batchApprovalsEnabled?: boolean
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

// =============================================================================
// Hook
// =============================================================================

export function useNatsChatAdapter(
  config: UseNatsChatAdapterConfig,
  options: UseNatsChatAdapterOptions = {},
): UnifiedChatState {
  const { active = true } = options
  const {
    dialogId,
    getNatsWsUrl,
    clientConfig,
    publishUserMessage,
    fetchChunks,
    enableThinking,
    batchApprovalsEnabled,
  } = config

  const [messages, setMessages] = useState<UnifiedChatMessage[]>([])
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>('idle')

  // Stable callback ref so `useRealtimeChunkProcessor`'s options object
  // doesn't churn every render and tear down the accumulator state.
  const callbacksRef: MutableRefObject<{
    onSegmentsUpdate: (segments: MessageSegment[]) => void
    onStreamStart: () => void
    onStreamEnd: () => void
  }> = useRef({
    onSegmentsUpdate: (segments: MessageSegment[]) => {
      setMessages((prev) => updateTrailingAssistant(prev, segments))
    },
    onStreamStart: () => setStreamingPhase('streaming'),
    onStreamEnd: () => setStreamingPhase('idle'),
  })

  // Real-time chunk → segment processor.
  const { processChunk, reset: resetAccumulator } = useRealtimeChunkProcessor({
    callbacks: {
      onSegmentsUpdate: (segments) => callbacksRef.current.onSegmentsUpdate(segments),
      onStreamStart: () => callbacksRef.current.onStreamStart(),
      onStreamEnd: () => callbacksRef.current.onStreamEnd(),
    },
    enableThinking,
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

  // Trigger initial backfill whenever a fresh dialog activates. Mirrors the
  // pattern in `.use-chunk-catchup.md`: enable buffering first so realtime
  // chunks queue behind the historical fetch, then flush in order.
  useEffect(() => {
    if (!active || !dialogId) return
    resetChunkTracking()
    startInitialBuffering()
    catchUpChunks().catch((err) => {
      console.error('[useNatsChatAdapter] initial catchup failed:', err)
    })
  }, [active, dialogId, resetChunkTracking, startInitialBuffering, catchUpChunks])

  // Live tail subscription. `enabled` is gated on both `active` and a
  // non-null dialogId so the consumer doesn't pay socket cost before
  // a conversation exists.
  useNatsDialogSubscription({
    enabled: active && dialogId != null,
    dialogId,
    getNatsWsUrl,
    clientConfig,
    onEvent: (payload: unknown, messageType: NatsMessageType) => {
      // Route via catchup so the buffer/dedupe logic stays consistent
      // with historical playback. `useChunkCatchup` itself forwards to
      // `processChunk` once dedupe checks pass.
      catchupProcessChunk(payload as ChunkData, messageType)
    },
  })

  // ─── Public API ───────────────────────────────────────────────────────────

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
    // NATS streams are driven server-side; the client can't really
    // "cancel" an in-flight agent task without backend cooperation.
    // For now we just drop the UI status — incoming chunks will still
    // be accepted and rendered if the agent completes anyway.
    setStreamingPhase('idle')
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    resetAccumulator()
    setStreamingPhase('idle')
  }, [resetAccumulator])

  // No-op refs — Mingo agent has no RAG entity-card affordances.
  const discussRef = useCallback((_ref: ChatRef) => {
    /* no-op in Mingo mode */
  }, [])
  const displayRef = useCallback((_ref: ChatRef) => {
    /* no-op in Mingo mode */
  }, [])

  // ─── Return shape ─────────────────────────────────────────────────────────

  const isLoading = streamingPhase !== 'idle'

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
      // SSE-only telemetry — null in NATS mode.
      currentProvider: null,
      currentModelLabel: null,
      currentContextWindowMaxTokens: null,
      currentInputTokens: null,
      currentOutputTokens: null,
      currentCacheHitRatePct: null,
      currentUsageBreakdown: null,
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
    ],
  )
}
