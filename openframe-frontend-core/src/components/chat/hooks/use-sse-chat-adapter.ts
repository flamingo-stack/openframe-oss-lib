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
 * (fetch/abort, request-body building), localStorage persistence
 * (PersistedChatState v1 — the sendIdx fan-out lookup below is the
 * rehydration contract), and the public `UnifiedChatState` mapping.
 *
 * Two key contracts vs hub-side chat hooks:
 *
 *   1. `source` is READ FROM THE RUNTIME, not a parameter. It is OPTIONAL —
 *      platform-agnostic embedders leave it unset; an empty `source` falls back
 *      to a stable constant (`DEFAULT_CHAT_SOURCE`) for the localStorage history
 *      namespace. It is NEVER sent on the wire (the hub resolves source
 *      server-side via `currentPlatform()`).
 *
 *   2. `tableIdForDocumentType` is INJECTED via the optional
 *      `tableIdForDocumentType` parameter. Hub callers pass the
 *      registry-backed lookup from `lib/config/rag-table-config`;
 *      embedders that don't supply one fall back to
 *      `defaultTableIdForDocumentType` so the `displayRef` / `discussRef`
 *      Ask + Display buttons WORK out of the box.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import type { ChatRef } from '../chat-ref.types'
import type { Message } from '../types/message.types'
import type { MessageSegment } from '../types/message.types'
import { useSlashCommandRegistry, type SlashCommandSummary } from './use-slash-commands'
import { getChatProxyAuth } from '../utils/chat-proxy-auth-storage'
import { chatAuthedFetch } from '../utils/chat-authed-fetch'
import type { ScrollAnchor } from '../utils/scroll-anchor'
import { createSseFrameDecoder } from '../../../chat-protocol/decode'
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../utils/auto-continuation-directive'
import { flattenAssistantContent } from '../utils/flatten-assistant-content'
import { sanitizeTitleForChat } from '../utils/slash-dispatch-utils'
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
   * fetch (used to hydrate the `displayRef` table lookup). Mirrors the
   * NATS adapter's `active` gate: `useUnifiedChat` passes `false` while
   * Guide mode is configured-but-not-active, so opening the panel in
   * Mingo mode does NOT hit the commands endpoint. Default `true` so
   * standalone callers keep the eager prefetch.
   */
  active?: boolean
}

// =============================================================================
// localStorage persistence — PersistedChatState v1
// =============================================================================

const CHAT_STORAGE_VERSION = 1

/** localStorage history namespace used when no `source` is configured on the
 *  runtime. Embedders are platform-agnostic (see `ChatRuntime.source`), so any
 *  stable string works here — the hub passes its real platform instead. */
const DEFAULT_CHAT_SOURCE = 'embed'

/** Storage key — includes the proxy-auth impersonation email when
 *  present so each impersonated customer keeps a SEPARATE chat history. */
const chatStorageKey = (source: DocSource): string => {
  const base = `mingo-chat-${source}-v${CHAT_STORAGE_VERSION}`
  const auth = getChatProxyAuth()
  if (auth?.email) {
    return `${base}-u-${encodeURIComponent(auth.email.toLowerCase())}`
  }
  return base
}

/** Sweep stale per-user chat-history keys. Drops any key whose email
 *  differs from the CURRENT proxy-auth identity. */
function pruneStaleChatStorage(source: DocSource): void {
  if (typeof window === 'undefined') return
  try {
    const currentKey = chatStorageKey(source)
    const prefix = `mingo-chat-${source}-v${CHAT_STORAGE_VERSION}-u-`
    const legacy = `mingo-chat-${source}-v${CHAT_STORAGE_VERSION}`
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (!k.startsWith(prefix)) continue
      if (k === currentKey) continue
      if (k === legacy) continue
      toRemove.push(k)
    }
    for (const k of toRemove) {
      window.localStorage.removeItem(k)
    }
  } catch {
    // localStorage access blocked (Safari private mode etc.) — non-fatal.
  }
}

interface PersistedChatState {
  messages: Message[]
  sources: Array<[number, ChatSource[]]>
  /** Per-turn refs for inline object cards. */
  refs?: Array<[number, Record<string, ChatRef>]>
  sendCount: number
}

function loadPersistedChat(source: DocSource): PersistedChatState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(chatStorageKey(source))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedChatState
    if (!parsed || !Array.isArray(parsed.messages)) return null
    // Rehydrate Date objects + run forward-compat migrations.
    for (const m of parsed.messages) {
      if (typeof m.timestamp === 'string') m.timestamp = new Date(m.timestamp)
      // Forward-migration for auto-continuation directive bubbles.
      if (
        m.role === 'user' &&
        !m.hidden &&
        typeof m.content === 'string' &&
        m.content.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX)
      ) {
        m.hidden = true
      }
    }
    return parsed
  } catch {
    return null
  }
}

function savePersistedChat(source: DocSource, state: PersistedChatState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(chatStorageKey(source), JSON.stringify(state))
  } catch {
    // Quota exceeded or private mode — silently drop.
  }
}

/** v1 wire `Message` → reducer message. The v1 blob stores assistant
 *  segments inside `content`; the reducer keeps `content` a string and
 *  segments separate. */
function persistedToReducerMessage(m: Message): UnifiedChatMessage {
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

/** Reducer message → v1 wire `Message`. Exact inverse of the loader so the
 *  persist round-trip re-saves an equivalent v1 blob (the golden contract). */
function reducerToPersistedMessage(m: UnifiedChatMessage): Message {
  return {
    id: m.id,
    role: m.role,
    ...(m.name !== undefined ? { name: m.name } : {}),
    content: (m.segments ?? m.content) as Message['content'],
    ...(m.timestamp !== undefined ? { timestamp: m.timestamp } : {}),
    ...(m.avatar != null ? { avatar: m.avatar } : {}),
    ...(m.hidden ? { hidden: true } : {}),
    ...(m.chatRefs ? { chatRefs: m.chatRefs } : {}),
  } as Message
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
 * parameter. An empty `source` falls back to `DEFAULT_CHAT_SOURCE` (used only for
 * the localStorage history namespace; never sent on the wire).
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
    (text: string, options?: InternalSendMessageOptions) => Promise<void>
  >(async () => {})

  const cardApprove = useCallback((reqId?: string): void | Promise<void> => {
    if (!reqId) return
    return sendMessageRef.current('', {
      hidden: true,
      approvalAction: { proposalId: reqId, action: 'approve' },
    })
  }, [])
  const cardReject = useCallback((reqId?: string): void | Promise<void> => {
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

  // Restore persisted state once on mount — the v1 blob seeds the reducer's
  // thread + its sendIdx-keyed sources/refs maps + the send counter.
  const persistedRef = useRef<PersistedChatState | null>(null)
  if (persistedRef.current === null) {
    pruneStaleChatStorage(source)
    persistedRef.current =
      loadPersistedChat(source) || { messages: [], sources: [], sendCount: 0 }
    const reducer = storeRef.current.getReducer(source, DEFAULT_DIALOG_SIDE, createReducerOptions)
    reducer.initializeWithState(persistedRef.current.messages.map(persistedToReducerMessage))
    reducer.seedSseMaps({
      sources: persistedRef.current.sources as Array<[number, unknown[]]>,
      refs: persistedRef.current.refs,
      sendCount: persistedRef.current.sendCount,
    })
  }

  const { state, applyEvent, flushDeltas, mutate, reducer } = useChatStreamReducer({
    store: storeRef.current,
    dialogId: source,
    createReducerOptions,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

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

  // ─── Persistence — save on every messages change ──────────────────────────
  // Sources/refs/sendCount live in the reducer's maps; read at write time.
  const persist = useCallback(
    (nextMessages: UnifiedChatMessage[]) => {
      const turnMeta = reducer.state.turnMeta
      savePersistedChat(source, {
        messages: nextMessages.map(reducerToPersistedMessage),
        sources: Array.from(turnMeta.sources.entries()) as Array<[number, ChatSource[]]>,
        refs: Array.from(turnMeta.refs.entries()),
        sendCount: turnMeta.sendCount,
      })
    },
    [source, reducer],
  )
  useEffect(() => {
    persist(state.messages)
  }, [state.messages, persist])

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

  const sendMessage = useCallback(
    async (text: string, sendOptions?: InternalSendMessageOptions): Promise<void> => {
      const { hidden, attachments, commandOverride, approvalAction } = sendOptions ?? {}

      // Conversation history for the server: everything BEFORE this send,
      // `hidden:true` rows included (LLM context) but their flag filtered
      // shape-wise like legacy — hidden messages are excluded entirely.
      const history = reducer.state.messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.hidden)
        .map((m) => ({
          role: m.role,
          content: m.segments ? flattenAssistantContent(m.segments) : (m.content as string),
        }))

      // URL + body branch — approvalAction routes to the approval-tool
      // endpoint, the standard chat path routes to the chat-stream endpoint.
      // `source` is INTENTIONALLY NOT in the body: the chat route resolves
      // it server-side via its own platform-detection — tamper-proof binding.
      const targetPath = approvalAction
        ? endpointsRef.current.approvalToolUrl
        : endpointsRef.current.chatStreamUrl
      const requestBody = approvalAction
        ? {
            proposal_id: approvalAction.proposalId,
            action: approvalAction.action,
            messages: history,
          }
        : {
            messages: [...history, { role: 'user', content: text }],
            ...(commandOverride ? { commandOverride } : {}),
            ...(attachments && attachments.length > 0
              ? { pendingAttachments: attachments as ChatAttachment[] }
              : {}),
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
          throw new Error(`Chat request failed: ${response.status}`)
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
      } catch (err) {
        // AbortError on user-initiated stop is expected — keep the partial
        // message, no error row.
        if ((err as { name?: string })?.name !== 'AbortError' && !ctrl.signal.aborted) {
          flushDeltas()
          mutate((r) =>
            r.failSseTurn(
              err instanceof Error
                ? err.message
                : 'An error occurred while processing your request.',
            ),
          )
        }
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
    [reducer, mutate, applyEvent, flushDeltas],
  )
  sendMessageRef.current = sendMessage

  const stopMessage = useCallback(() => {
    abortControllerRef.current?.abort()
    flushDeltas()
    mutate((r) => r.setPhase('idle'))
  }, [mutate, flushDeltas])

  const clearMessages = useCallback(() => {
    mutate((r) => r.reset())
    // Clear persisted state too so the next mount starts fresh.
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(chatStorageKey(source))
      } catch {}
    }
  }, [mutate, source])

  // ─── Public message mapping (sendIdx fan-out lookup) ──────────────────────
  // Index sources/refs/scrollAnchor by USER-SEND count (`sendIdx`), not by
  // assistant-message count. Each user send produces exactly ONE refs entry
  // server-side, but it can produce MULTIPLE assistant messages on the
  // client (main RAG reply + post-approve card + auto-continuation prose).
  // Counting VISIBLE user sends and mapping every following assistant
  // message to that index keeps the lookup stable — this is the
  // PersistedChatState v1 rehydration contract.
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
      // via `entityIdFilter` before the LLM is invoked.
      const sanitizedTitle = sanitizeTitleForChat(reference.title)
      const prompt = `Tell me more about ${sanitizedTitle || 'this item'}`
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
    // Guide mode currently keeps its history in `localStorage` opaquely
    // under the hood (`runtime.source` namespaced key). Surfacing that
    // history as a structured dialog list is a follow-up; for now the
    // shape is satisfied with empty defaults so the unified contract
    // type-checks and EmbeddableChat hides sidebar affordances when
    // `dialogs.length === 0`.
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
  /* no-op until Guide localStorage history is exposed */
}
const noopRenameDialog = async (_id: string, _title: string): Promise<void> => {
  /* no-op until Guide localStorage history is exposed */
}
const noopArchiveDialog = async (_id: string): Promise<void> => {
  /* no-op until Guide localStorage history is exposed */
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
