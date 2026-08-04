'use client'

/**
 * useSseChatAdapter — the SSE/Guide-mode transport adapter for the unified
 * chat surface. One of two `UnifiedChatState` implementations; its NATS
 * counterpart is `useNatsChatAdapter` (Mingo mode). The public
 * `useChat({ mode })` dispatches between them based on `mode.transport`.
 *
 * Phase 3 of the chat unification: the adapter no longer owns a parser or a
 * message-merge layer. Raw response bytes flow
 *
 *   fetch body → createSseFrameDecoder → ChatStreamEvent →
 *   createChatStreamReducer (transport: 'sse') — THE master reader
 *
 * The reducer absorbed `useChat`'s trailing-assistant merge, the
 * `decision_resolved` receipt path, and the sendIdx-keyed
 * sources/refs/meta maps; this file keeps only the transport wiring
 * (fetch/abort, request-body building), the server-issued conversation-id
 * persistence (id ONLY — see below), the mount-time server-history
 * hydration seam, and the public `UnifiedChatState` mapping.
 *
 * Conversation identity + history (server SSOT):
 *
 *   - Conversation ids are SERVER-minted. The first send of a session goes
 *     out id-less; the server mints an id and echoes it in the leading
 *     metadata frame (surfaced by the decoder as
 *     `ChatMetadataEvent.conversationId`), and every later turn echoes it
 *     back in the request body.
 *   - localStorage stores ONLY that echoed id (`chat-conversation-storage`).
 *     Message history lives server-side in `chat_conversations` /
 *     `chat_messages` and is rebuilt on mount via `useChatHistoryHydration`,
 *     which materializes through the reducer (`initializeWithState` /
 *     `prependMessages` + `seedSseMaps`).
 *   - The wire carries ONLY the newest user message — never a replay of the
 *     client-side thread (the server re-reads `chat_messages` by
 *     conversation id on every turn).
 *
 * Two key contracts vs hub-side chat hooks:
 *
 *   1. `source` is READ FROM THE RUNTIME, not a parameter. It is OPTIONAL —
 *      platform-agnostic embedders leave it unset; an empty `source` falls back
 *      to a stable constant (`DEFAULT_CHAT_SOURCE`) for the localStorage
 *      conversation-id namespace. It is NEVER sent on the wire (the hub
 *      resolves source server-side via `currentPlatform()`).
 *
 *   2. `tableIdForDocumentType` is INJECTED via the optional
 *      `tableIdForDocumentType` parameter. Hub callers pass the
 *      registry-backed lookup from `lib/config/rag-table-config`;
 *      embedders that don't supply one fall back to
 *      `defaultTableIdForDocumentType` so the `displayRef` / `discussRef`
 *      Ask + Display buttons WORK out of the box.
 */

import { useCallback, useMemo, useRef } from 'react'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import type { ChatRef } from '../chat-ref.types'
import type { Message } from '../types/message.types'
import type { MessageSegment } from '../types/message.types'
import { useSlashCommandRegistry, type SlashCommandSummary } from './use-slash-commands'
import { chatAuthedFetch } from '../utils/chat-authed-fetch'
import type { ScrollAnchor } from '../utils/scroll-anchor'
import { createSseFrameDecoder } from '../../../chat-protocol/decode'
import type { ChatStreamEvent } from '../../../chat-protocol/events'
import {
  createChatConversationStorage,
  pruneStaleChatConversationStorage,
} from '../utils/chat-conversation-storage'
import { useChatHistoryHydration } from './use-chat-history-hydration'
import { sanitizeTitleForChat } from '../utils/slash-dispatch-utils'
import { buildDiscussPrompt } from '../utils/discuss-ref-prompt'
import { defaultTableIdForDocumentType } from '../utils/source-icons'
import type { WireCommandOverride } from '../utils/slash-dispatch-utils'
import type { ChatAttachment } from '../utils/chat-attachment-markdown'
import type {
  UnifiedChatState,
  UnifiedChatMessage,
  UnifiedSendMessageOptions,
} from '../types/unified-chat-state.types'
import type { DialogItem } from '../types/component.types'
import { createChatDialogStore, DEFAULT_DIALOG_SIDE } from '../stream/chat-dialog-store'
import { useChatStreamReducer } from '../stream/use-chat-stream-reducer'
import type { ChatDialogStore } from '../stream/chat-dialog-store'
import type { ChatStreamReducerOptions } from '../stream/chat-stream-reducer'

// Canonical home of the per-turn meta row moved to the stream module in
// Phase 3; re-exported here to keep the legacy import path stable.
export type { ChatTurnMeta } from '../stream/chat-stream-reducer'

// =============================================================================
// Public types
// =============================================================================

/** Source identifier — opaque string ID (registry lookup happens in the
 *  hub-side platform-utils, not in lib). */
export type DocSource = string

export interface ChatSource {
  index: number
  name: string
  path: string
  documentType: string
  externalUrl?: string
  /** Platform that owns the destination at `externalUrl`. */
  targetPlatform?: string | null
  /** Primary-key value for single-row chips. */
  id?: string
  /** Per-row items for grouped chips. */
  items?: Array<{
    id: string
    documentType: string
    name: string
    externalUrl?: string
    targetPlatform?: string | null
    /** In-app doc-tree path for markdown / data-room-doc rows so the
     *  grouped chip's anchor can trigger an in-page doc-tree swap via
     *  `handleChatNavClick` (parity with single-row chips + cards). */
    path?: string | null
  }>
  /** RagTableConfig.id for this source. */
  sourceRepo?: string
  /** Optional display label override returned by the chat API. */
  label?: string
}

export interface DocChatMessage {
  id: string
  role: 'user' | 'assistant'
  /** String form for legacy callers that just want the answer text; structured
   *  segments include thinking blocks too, which the lib's
   *  ChatMessageEnhanced renders as <ThinkingDisplay> cards. */
  content: string
  /** Structured segments. When set, callers should prefer this over `content`. */
  segments?: MessageSegment[]
  sources?: ChatSource[]
  /** Per-row refs for inline object-card rendering. Keyed by
   *  `<documentType>:<primaryKey>`. Populated for assistant messages only. */
  chatRefs?: Record<string, ChatRef>
  /** Per-message viewport-positioning hint emitted by the server. */
  scrollAnchor?: ScrollAnchor
  /** When true the message is part of the conversation history but is
   *  NOT rendered in the chat UI. */
  hidden?: boolean
}

// `StreamingPhase` is unified across transports — re-exported here to
// preserve the legacy import path. Canonical home is now
// `types/unified-chat-state.types.ts`.
export type { StreamingPhase } from '../types/unified-chat-state.types'

/**
 * Optional dependency-injection options for `useSseChatAdapter`.
 *
 *   - `tableIdForDocumentType` — looks up the RagTableConfig.id for an
 *     LLM document type. Used by `displayRef` + `discussRef` to translate
 *     an inline-card click into a server-side entity-id filter.
 *
 *     **Defaults to `defaultTableIdForDocumentType` from
 *     `src/utils/source-icons.ts`** — a lib-baked map covering every
 *     documentType currently registered in the hub's RAG_TABLE_CONFIGS.
 *     Override only for polymorphic / per-tenant document types.
 */
export interface UseSseChatAdapterOptions {
  tableIdForDocumentType?: (documentType: string) => string | null
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
  active?: boolean
}

// =============================================================================
// Local persistence — the server-issued conversation id ONLY
// =============================================================================
//
// The ONLY thing persisted locally is the conversation id the SERVER minted
// and echoed in the leading metadata frame of the session's first turn.
// The client never generates ids. Message history lives server-side in
// `chat_conversations` / `chat_messages` (recorded turn-by-turn by the chat
// route) and is rehydrated on mount via `GET <chatStreamUrl>/history`.
// localStorage never stores messages, sources, refs, or send counts —
// the server transcript is the single source of truth for history.
// (The retired PersistedChatState v1 full-history blobs are swept on mount
// by `pruneStaleChatConversationStorage` — never read, never migrated.)

/** localStorage namespace used when no `source` is configured on the
 *  runtime. Embedders are platform-agnostic (see `ChatRuntime.source`), so any
 *  stable string works here — the hub passes its real platform instead. */
const DEFAULT_CHAT_SOURCE = 'embed'

// Persistence itself lives in `../utils/chat-conversation-storage.ts` (built
// on the lib-standard `createLocalStorageAdapter`); the mount-time history
// rebuild lives in `./use-chat-history-hydration.ts`.

/** Server-hydrated wire `Message` → reducer message. Hydrated rows carry
 *  plain-string content; the defensive segments branch keeps the mapper
 *  total over the wider `Message` union the hydration seam is typed with. */
function historyMessageToReducerMessage(m: Message): UnifiedChatMessage {
  const segments = Array.isArray(m.content) ? (m.content as MessageSegment[]) : undefined
  return {
    id: m.id,
    role: m.role,
    content: typeof m.content === 'string' ? m.content : '',
    ...(segments ? { segments } : {}),
    ...(m.name !== undefined ? { name: m.name } : {}),
    ...(m.avatar != null ? { avatar: m.avatar } : {}),
    ...(m.timestamp !== undefined ? { timestamp: m.timestamp } : {}),
    ...(m.hidden ? { hidden: true } : {}),
    ...(m.chatRefs ? { chatRefs: m.chatRefs } : {}),
  } as UnifiedChatMessage
}

// =============================================================================
// useSseChatAdapter — public hook
// =============================================================================

/**
 * Stream-driven AI chat hook. Returns the message list, send/stop/clear
 * controls, and per-turn metadata (model name, token counts, routing
 * decision) the lib's `<ChatContainer>` consumes.
 *
 * Source identity comes from `useRequiredChatRuntime().source` — no
 * parameter. An empty `source` falls back to `DEFAULT_CHAT_SOURCE` (used only
 * for the conversation-id localStorage namespace; never sent on the wire).
 */
export function useSseChatAdapter(
  options?: UseSseChatAdapterOptions,
  runtimeOptions: UseSseChatAdapterRuntimeOptions = {},
): UnifiedChatState {
  const { active = true } = runtimeOptions
  // Chat-specific code REQUIRES a runtime — the lib's `<HubRuntimeProvider>`
  // (hub) / embedder's provider must wrap the tree.
  const runtime = useRequiredChatRuntime()
  const source = runtime.source || DEFAULT_CHAT_SOURCE
  const tableIdForDocumentType =
    options?.tableIdForDocumentType ?? defaultTableIdForDocumentType

  // ─── Reducer wiring ────────────────────────────────────────────────────────
  // One store per hook instance; one reducer keyed by the source. Approval
  // card buttons fire a server-driven confirm-tool turn via `sendMessage`
  // (hidden approval-action send) — routed through a ref so the reducer's
  // creation-time callbacks stay stable.

  const sendMessageRef = useRef<
    (text: string, options?: InternalSendMessageOptions) => Promise<boolean>
  >(async () => true)

  // Approve/reject pass the transport's boolean outcome through so batch
  // approve-all loops can mark a FAILED row (expired proposal, network
  // error) instead of leaving its execution loader spinning.
  const cardApprove = useCallback((reqId?: string): void | Promise<boolean> => {
    if (!reqId) return
    return sendMessageRef.current('', {
      hidden: true,
      approvalAction: { proposalId: reqId, action: 'approve' },
    })
  }, [])
  const cardReject = useCallback((reqId?: string): void | Promise<boolean> => {
    if (!reqId) return
    return sendMessageRef.current('', {
      hidden: true,
      approvalAction: { proposalId: reqId, action: 'reject' },
    })
  }, [])

  const createReducerOptions = useCallback(
    (): ChatStreamReducerOptions => ({
      transport: 'sse',
      callbacks: { onApprove: cardApprove, onReject: cardReject },
    }),
    [cardApprove, cardReject],
  )

  const storeRef = useRef<ChatDialogStore | null>(null)
  if (storeRef.current === null) storeRef.current = createChatDialogStore()

  const { state, applyEvent, flushDeltas, mutate, reducer } = useChatStreamReducer({
    store: storeRef.current,
    dialogId: source,
    createReducerOptions,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  // ─── Conversation identity — server-minted id, restored once on mount ─────
  // Null = no conversation yet: the FIRST send goes out without an id, the
  // server mints one, and the metadata-frame capture (in the send loop below)
  // stores it. The client NEVER generates ids. This is the ONLY local
  // persistence — message history hydrates from the server transcript below.
  const conversationStorage = useMemo(() => createChatConversationStorage(source), [source])
  const conversationIdRef = useRef<string | null>(null)
  const restoredConversationRef = useRef(false)
  if (!restoredConversationRef.current) {
    restoredConversationRef.current = true
    // Sweeps other-identity keys AND the retired v1 full-history blobs.
    pruneStaleChatConversationStorage(source)
    conversationIdRef.current = conversationStorage.load()?.conversationId ?? null
  }

  // ─── Slash-command registry (displayRef lookup) ───────────────────────────
  // Reads from the SAME react-query cache entry as `<EmbeddableChat>`'s
  // onboarding-card list (keyed on `commandsUrl`), so Guide mode fetches
  // `commands` ONCE. Gated on `active` so a Mingo-only panel — where this
  // adapter is mounted but idle — never hits the endpoint.
  const commandsUrl = runtime.endpoints.commandsUrl
  const { commands: slashCommands } = useSlashCommandRegistry(commandsUrl, {
    enabled: active,
  })
  const cmdIdByTableId = useMemo(() => {
    const buckets = new Map<string, SlashCommandSummary[]>()
    for (const cmd of slashCommands) {
      if (!cmd.primarySourceId) continue
      const arr = buckets.get(cmd.primarySourceId) ?? []
      arr.push(cmd)
      buckets.set(cmd.primarySourceId, arr)
    }
    const map = new Map<string, string>()
    for (const [tableId, cmds] of buckets) {
      const display = cmds.find((c) => c.actions.some((a) => a.id === 'display'))
      const picked =
        display ??
        [...cmds].sort((a, b) => {
          const ao = a.displayOrder ?? Number.POSITIVE_INFINITY
          const bo = b.displayOrder ?? Number.POSITIVE_INFINITY
          return ao - bo
        })[0]
      if (picked) map.set(tableId, picked.id)
    }
    return map
  }, [slashCommands])

  // ─── Server hydration (history SSOT) ──────────────────────────────────────
  // Mount-time rebuild of the message list from the server transcript — the
  // single store of conversation history. The fetch/guard/decode lives in
  // `use-chat-history-hydration.ts` (see there for the full contract +
  // failure semantics: a miss starts the UI empty, never loses server
  // context). THIS adapter owns the materialization seam: the hook hands
  // back plain `Message[]` rows plus per-send refs + the user-turn count
  // (via the two shim refs below), and `hydrateMessages` feeds ALL of it
  // through the REDUCER — `initializeWithState` on an empty thread,
  // `prependMessages` when the user already sent before hydration landed
  // (nothing typed is lost; the server resolves LLM history from its own
  // store either way), and `seedSseMaps` for the sendIdx-keyed refs + the
  // send counter. No parallel merge path.
  const historyUrl =
    runtime.endpoints.chatHistoryUrl ??
    `${runtime.endpoints.chatStreamUrl.replace(/\/+$/, '')}/history`
  const hydrationRefsMapRef = useRef<Map<number, Record<string, ChatRef>>>(new Map())
  const hydrationSendCountRef = useRef(0)
  const hydrateMessages = useCallback(
    (history: Message[]) => {
      mutate((r) => {
        const mapped = history.map(historyMessageToReducerMessage)
        const liveSendCount = r.state.turnMeta.sendCount
        if (r.state.messages.length === 0) {
          r.initializeWithState(mapped)
        } else {
          r.prependMessages(mapped)
        }
        r.seedSseMaps({
          refs: Array.from(hydrationRefsMapRef.current.entries()),
          sendCount: hydrationSendCountRef.current + liveSendCount,
        })
      })
    },
    [mutate],
  )
  const { isHydratingHistory, hydratedKeyRef } = useChatHistoryHydration({
    active,
    source,
    historyUrl,
    conversationIdRef,
    refsMapRef: hydrationRefsMapRef,
    sendCountRef: hydrationSendCountRef,
    hydrateMessages,
    // Meta invalidation is a reducer concern here: `seedSseMaps` (inside
    // `hydrateMessages` above) already invalidates the snapshot.
    bumpMetaTick: noopBumpMetaTick,
  })

  // ─── Send / stream loop ────────────────────────────────────────────────────

  /**
   * Internal sendMessage options — union of the public
   * `UnifiedSendMessageOptions` (semantic fields: `hidden`, `attachments`)
   * and SSE-only internal extras (`commandOverride`, `approvalAction`)
   * set by `discussRef` / `displayRef` / the approval-card callbacks.
   */
  type InternalSendMessageOptions = UnifiedSendMessageOptions & {
    commandOverride?: WireCommandOverride
    approvalAction?: { proposalId: string; action: 'approve' | 'reject' }
  }

  const endpointsRef = useRef(runtime.endpoints)
  endpointsRef.current = runtime.endpoints

  /** Capture the SERVER-minted conversation id from a decoded metadata
   *  event. On the session's FIRST turn this is where the client learns
   *  its id — persist it so later turns and future visits continue the
   *  same conversation. The reducer ignores the field (identity is a
   *  transport/persistence concern, not render state). */
  const captureConversationId = useCallback(
    (event: ChatStreamEvent): void => {
      if (event.type !== 'metadata') return
      const id = event.conversationId
      if (typeof id !== 'string' || !id) return
      if (conversationIdRef.current === id) return
      conversationIdRef.current = id
      conversationStorage.save({ conversationId: id })
    },
    [conversationStorage],
  )

  const sendMessage = useCallback(
    // Resolves `true` on a clean turn, `false` when the request failed
    // (surfaced to batch approve-all loops via the card callbacks).
    async (text: string, sendOptions?: InternalSendMessageOptions): Promise<boolean> => {
      const { hidden, attachments, commandOverride, approvalAction } = sendOptions ?? {}

      // URL + body branch — approvalAction routes to the approval-tool
      // endpoint, the standard chat path routes to the chat-stream endpoint.
      // `source` is INTENTIONALLY NOT in the body: the chat route resolves
      // it server-side via its own platform-detection — tamper-proof binding.
      //
      // The server is the single source of conversation history: it re-reads
      // `chat_messages` by conversation id on every turn. The wire therefore
      // carries ONLY the new user message — never the prior conversation.
      const conversationId = conversationIdRef.current
      const targetPath = approvalAction
        ? endpointsRef.current.approvalToolUrl
        : endpointsRef.current.chatStreamUrl
      const requestBody = approvalAction
        ? {
            proposal_id: approvalAction.proposalId,
            action: approvalAction.action,
            // Always present here — an approval can only happen inside an
            // established conversation (the proposal turn captured the id).
            conversationId,
          }
        : {
            messages: [{ role: 'user', content: text }],
            ...(commandOverride ? { commandOverride } : {}),
            ...(attachments && attachments.length > 0
              ? { pendingAttachments: attachments as ChatAttachment[] }
              : {}),
            ...(conversationId ? { conversationId } : {}),
          }

      // Optimistic user bubble + assistant placeholder + phase 'thinking'
      // + sendCount++ — one reducer command.
      mutate((r) =>
        r.beginSseSend({ text, hidden, userName: 'You', assistantName: 'Mingo AI' }),
      )

      const ctrl = new AbortController()
      abortControllerRef.current = ctrl

      try {
        // `chatAuthedFetch` carries the bearer-act-as headers (+ Supabase
        // session cookies) — same wrapper `use-chat-attachments` and
        // `use-chat-identity` use.
        const response = await chatAuthedFetch(targetPath, {
          method: 'POST',
          body: JSON.stringify(requestBody),
          signal: ctrl.signal,
        })
        if (!response.ok) {
          // Surface the SERVER's error copy (route-base envelope
          // `{error, code}`) — a bare "Chat request failed: 409" told
          // the user nothing when e.g. a batch approval expired; the
          // server ships real copy ("This approval expired — ...").
          let serverMessage: string | null = null
          try {
            const errBody = (await response.json()) as { error?: unknown }
            if (typeof errBody?.error === 'string' && errBody.error.length > 0) {
              serverMessage = errBody.error
            }
          } catch {
            /* non-JSON error body — fall through to the generic copy */
          }
          throw new Error(serverMessage ?? `Chat request failed: ${response.status}`)
        }
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        // Decoder is per-send (a rapid send-stop-send sequence must never
        // feed the second stream's first chunk into the first stream's
        // tail buffer).
        const frameDecoder = createSseFrameDecoder()
        let finished = false
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (ctrl.signal.aborted) break
            for (const event of frameDecoder.push(value)) {
              captureConversationId(event)
              applyEvent(event)
            }
          }
          finished = true
        } finally {
          // `end()` always runs so the decoder settles; its events (the
          // trailing usage frame) apply only on a CLEAN end — aborts
          // propagate without extra state (legacy parity).
          const endEvents = frameDecoder.end()
          if (finished) {
            for (const event of endEvents) applyEvent(event)
          }
        }
        return true
      } catch (err) {
        // AbortError on user-initiated stop is expected — keep the partial
        // message, no error row, and DON'T report failure (`true`): the
        // request may have committed server-side, and a `false` here
        // would falsely tick a batch row's failure cross.
        if ((err as { name?: string })?.name === 'AbortError' || ctrl.signal.aborted) {
          return true
        }
        flushDeltas()
        mutate((r) =>
          r.failSseTurn(
            err instanceof Error
              ? err.message
              : 'An error occurred while processing your request.',
          ),
        )
        return false
      } finally {
        if (abortControllerRef.current === ctrl) {
          abortControllerRef.current = null
        }
        // Force-flush pending deltas BEFORE the completion state lands, then
        // settle the turn (drops an empty trailing placeholder — the reject
        // path streams no text — and returns the phase to idle).
        flushDeltas()
        mutate((r) => r.endSseTurn())
      }
    },
    [mutate, applyEvent, flushDeltas, captureConversationId],
  )
  sendMessageRef.current = sendMessage

  const stopMessage = useCallback(() => {
    abortControllerRef.current?.abort()
    flushDeltas()
    mutate((r) => r.setPhase('idle'))
  }, [mutate, flushDeltas])

  const clearMessages = useCallback(() => {
    mutate((r) => r.reset())
    // New chat = drop the stored conversation id. The old row stays frozen
    // server-side; the NEXT send goes out id-less and the server mints a
    // fresh conversation (echoed back and re-captured then). Resetting the
    // hydration guard means a re-captured id can hydrate again if needed.
    conversationIdRef.current = null
    conversationStorage.clear()
    hydrationRefsMapRef.current = new Map()
    hydrationSendCountRef.current = 0
    hydratedKeyRef.current = null
  }, [mutate, conversationStorage, hydratedKeyRef])

  // ─── Public message mapping (sendIdx fan-out lookup) ──────────────────────
  // Index sources/refs/scrollAnchor by USER-SEND count (`sendIdx`), not by
  // assistant-message count. Each user send produces exactly ONE refs entry
  // server-side, but it can produce MULTIPLE assistant messages on the
  // client (main RAG reply + post-approve card + auto-continuation prose).
  // Counting VISIBLE user sends and mapping every following assistant
  // message to that index keeps the lookup stable — server hydration seeds
  // the same maps (via `seedSseMaps`) so hydrated turns resolve identically.
  const docMessages: DocChatMessage[] = useMemo(() => {
    const { meta, sources: sourcesMap, refs: refsMap } = state.turnMeta
    let sendIdx = -1
    return state.messages.map((m) => {
      const segments = m.segments
      const content =
        typeof m.content === 'string' && !segments
          ? m.content
          : segments
              ?.filter((s) => s.type === 'text')
              .map((s) => (s as { type: 'text'; text: string }).text)
              .join('') ?? ''

      let sources: ChatSource[] | undefined
      let chatRefs: Record<string, ChatRef> | undefined
      let scrollAnchor: ScrollAnchor | undefined
      if (m.role === 'user' && !m.hidden) {
        sendIdx++
      }
      if (m.role === 'assistant') {
        const lookupIdx = sendIdx >= 0 ? sendIdx : 0
        sources = sourcesMap.get(lookupIdx) as ChatSource[] | undefined
        // The receipt path stamps `chatRefs` directly onto the assistant
        // message; prefer that message-bound copy when present, fall back
        // to the per-turn refs map.
        chatRefs = m.chatRefs ?? refsMap.get(lookupIdx)
        scrollAnchor = (meta.get(lookupIdx)?.scrollAnchor as ScrollAnchor | null) ?? undefined
      }

      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content,
        ...(segments ? { segments } : {}),
        ...(sources ? { sources } : {}),
        ...(chatRefs ? { chatRefs } : {}),
        ...(scrollAnchor ? { scrollAnchor } : {}),
        ...(m.hidden ? { hidden: true } : {}),
      }
    })
  }, [state.messages, state.turnMeta])

  /**
   * "Display" callback for inline cards whose registry entry sets
   * `displayAction: true`. Parallel to `discussRef` but emits a
   * `/<cmd> display "<title>"` slash command instead of the Discuss prose.
   */
  const displayRef = useCallback(
    (reference: ChatRef) => {
      const tableId = tableIdForDocumentType(reference.type)
      if (!tableId) {
        console.warn(
          `[useSseChatAdapter] displayRef: no tableId for documentType="${reference.type}"; ignoring click`,
        )
        return
      }
      const cmdId = cmdIdByTableId.get(tableId)
      if (!cmdId) {
        console.warn(
          `[useSseChatAdapter] displayRef: no slash command for tableId="${tableId}" source="${source}"; ignoring click`,
        )
        return
      }
      const refSlug =
        typeof reference.metadata?.slug === 'string' &&
        reference.metadata.slug.length > 0
          ? reference.metadata.slug
          : ''
      const queryValue =
        refSlug || sanitizeTitleForChat(reference.title) || reference.id
      // Escape `\` BEFORE `"` so a trailing backslash can't smuggle a
      // close-quote past parsers that honor JS-style escapes. Matches
      // `formatSingularLookupInvocation`'s pattern in slash-dispatch-utils.
      const escaped = queryValue
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
      const text = `/${cmdId} display "${escaped}"`
      sendMessage(text)
    },
    [sendMessage, source, cmdIdByTableId, tableIdForDocumentType],
  )

  /**
   * "Discuss" affordance for ObjectCard. Synthesizes a natural-language
   * prompt ("Tell me more about <title>"); the structured
   * `commandOverride.entityIdFilter` is sent server-side via the request
   * body so retrieval narrows to the named row.
   */
  const discussRef = useCallback(
    (reference: ChatRef) => {
      const tableId = tableIdForDocumentType(reference.type)
      if (!tableId) {
        console.warn(
          `[useSseChatAdapter] discussRef: no tableId for documentType="${reference.type}"; ignoring click`,
        )
        return
      }
      const refId = (reference.id ?? '').trim()
      if (!refId) {
        console.warn(
          `[useSseChatAdapter] discussRef: empty reference.id for type="${reference.type}"; ignoring click`,
        )
        return
      }
      // RETRIEVAL IS STRICTLY PRIMARY-KEY-DRIVEN. The visible prose
      // ("Tell me more about <title>") is UX-only; retrieval narrows
      // via `entityIdFilter` before the LLM is invoked. The sentence itself
      // comes from the shared builder so the Mingo transport (which has no
      // id filter and leans on the prose) phrases it identically.
      const prompt = buildDiscussPrompt(reference)
      sendMessage(prompt, {
        commandOverride: { entityIdFilter: { tableId, id: refId } },
      })
    },
    [sendMessage, tableIdForDocumentType],
  )

  // ─── Per-turn metadata resolution ─────────────────────────────────────────
  const latestMeta = useMemo(() => {
    const { meta, sendCount } = state.turnMeta
    return meta.get(sendCount - 1) ?? meta.get(sendCount - 2) ?? null
  }, [state])

  const streamingPhase = state.streamingPhase

  return {
    messages: docMessages,
    isLoading: streamingPhase !== 'idle',
    sendMessage,
    /** "Discuss" affordance for ObjectCard. */
    discussRef,
    /** "Display" counterpart of `discussRef`. */
    displayRef,
    stopMessage,
    clearMessages,
    streamingPhase,
    /** True while the mount-time rebuild from the server transcript runs. */
    isHydratingHistory,
    /** Provider key for the lib's `<ModelDisplay>` icon. */
    currentProvider: latestMeta?.provider ?? null,
    currentModelLabel: latestMeta?.modelLabel ?? null,
    currentContextWindowMaxTokens: latestMeta?.contextWindowMaxTokens ?? null,
    /** Input tokens (known after server's message_start frame; null until). */
    currentInputTokens: latestMeta?.inputTokens ?? null,
    /** Output tokens (known only after server's trailing usage frame). */
    currentOutputTokens: latestMeta?.outputTokens ?? null,
    /** Cache hit % (read / total-input × 100). null during streaming. */
    currentCacheHitRatePct: latestMeta?.cacheHitRatePct ?? null,
    /** Cross-call usage breakdown (Haiku rewriter/classifier/summarizer
     *  token counts). null until the trailing usage frame lands. */
    currentUsageBreakdown: latestMeta?.breakdown ?? null,
    // ─── Dialog management — stubs for v1 ────────────────────────────────
    // Guide mode keeps ONE server-side conversation per stored id
    // (`chat_conversations`, hydrated on mount). Surfacing multiple threads
    // as a structured dialog list is a follow-up; for now the shape is
    // satisfied with empty defaults so the unified contract type-checks and
    // EmbeddableChat hides sidebar affordances when `dialogs.length === 0`.
    dialogs: SSE_EMPTY_DIALOGS,
    activeDialogId: null,
    selectDialog: noopSelectDialog,
    startNewDialog: noopStartNewDialog,
    deleteDialog: noopDeleteDialog,
    renameDialog: noopRenameDialog,
    archiveDialog: noopArchiveDialog,
    isDialogsLoading: false,
    // SSE/guide has no server-side dialog list — never errors, nothing to retry.
    dialogsError: false,
    reloadDialogs: noopAsync,
    isMessagesLoading: false,
    hasMoreDialogs: false,
    loadMoreDialogs: noopAsync,
    hasMoreMessages: false,
    loadMoreMessages: noopAsync,
    approveRequest: noopApproveRequest,
    rejectRequest: noopRejectRequest,
    dialogTokenUsage: null,
    connectionState: 'connected' as const,
  }
}

// ─── Stable no-op references for the Guide-mode dialog-management stubs ──
// Plain module-scope constants so the adapter's return identity stays
// stable across renders — consumers that memo on these fields don't get
// spurious re-runs.
const SSE_EMPTY_DIALOGS: DialogItem[] = []
const noopSelectDialog = (_id: string | null): void => {
  /* Guide mode has no managed dialog list yet */
}
const noopStartNewDialog = async (): Promise<string | null> => null
const noopDeleteDialog = async (_id: string): Promise<void> => {
  /* no-op until Guide server-side history is exposed as dialogs */
}
const noopRenameDialog = async (_id: string, _title: string): Promise<void> => {
  /* no-op until Guide server-side history is exposed as dialogs */
}
const noopArchiveDialog = async (_id: string): Promise<void> => {
  /* no-op until Guide server-side history is exposed as dialogs */
}
const noopAsync = async (): Promise<void> => {
  /* no-op pagination stub */
}
const noopApproveRequest = async (_id: string): Promise<void> => {
  /* Guide mode has no tool-call approval workflow */
}
const noopRejectRequest = async (_id: string, _reason?: string): Promise<void> => {
  /* Guide mode has no tool-call approval workflow */
}
/** Stable no-op for the hydration hook's `bumpMetaTick` seam — reducer
 *  invalidation (inside `hydrateMessages`) already re-renders subscribers. */
const noopBumpMetaTick = (): void => {}
