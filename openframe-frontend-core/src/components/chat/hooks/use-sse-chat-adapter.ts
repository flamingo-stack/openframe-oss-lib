'use client'

/**
 * useSseChatAdapter — the SSE/Guide-mode transport adapter for the unified
 * chat surface. One of two `UnifiedChatState` implementations; its NATS
 * counterpart is `useNatsChatAdapter` (Mingo mode). The public
 * `useChat({ mode })` dispatches between them based on `mode.transport`.
 *
 * Renamed from `useEmbeddedChat` during the unified-chat refactor. The
 * legacy name is re-exported as an alias from `./use-embedded-chat` for
 * backward compatibility — internal lib code should import this canonical
 * name directly.
 *
 * Two key contracts vs hub-side chat hooks:
 *
 *   1. `source` is READ FROM THE RUNTIME, not a parameter. It is OPTIONAL —
 *      platform-agnostic embedders leave it unset; an empty `source` falls back
 *      to a stable constant (`DEFAULT_CHAT_SOURCE`) for the localStorage history
 *      namespace. It is NEVER sent on the wire (the hub resolves source
 *      server-side via `currentPlatform()`).
 *
 *   2. Navigation is runtime-provided. The hub-side `useDocSearch` keeps
 *      its own `decideNewTab` + `useDocNavigation.navigate` plumbing for
 *      the search autocomplete (it calls `router.push`). The chat body
 *      doesn't navigate via this hook — click handlers on rendered
 *      cards/chips go through `handleChatNavClick` instead.
 *
 *   3. `tableIdForDocumentType` is INJECTED via the optional
 *      `tableIdForDocumentType` parameter. Hub callers pass the
 *      registry-backed lookup from `lib/config/rag-table-config`;
 *      embedders that don't supply one fall back to
 *      `defaultTableIdForDocumentType` (the lib-baked map covering
 *      every documentType currently registered in the hub) so the
 *      `displayRef` / `discussRef` Ask + Display buttons WORK out of
 *      the box. Override only when you have polymorphic / per-tenant
 *      types the default doesn't cover.
 *
 * Wire format and SSE-parser logic mirror the hub original byte-for-byte
 * so server-side and client-side stay in lockstep across the migration.
 */

import { useState, useEffect, useCallback, useMemo, useRef, type MutableRefObject } from 'react'
import { useChat, type Message, type StreamFnExtraOptions } from './use-chat'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import type { ChatRef } from '../chat-ref.types'
import { buildChatRefKey } from '../types/chat.types'
import type { MessageSegment } from '../types/message.types'
import { useSlashCommandRegistry, type SlashCommandSummary } from './use-slash-commands'
import { getChatProxyAuth } from '../utils/chat-proxy-auth-storage'
import { chatAuthedFetch } from '../utils/chat-authed-fetch'
import { parseScrollAnchor, type ScrollAnchor } from '../utils/scroll-anchor'
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../utils/auto-continuation-directive'
import { flattenAssistantContent } from '../utils/flatten-assistant-content'
import { sanitizeTitleForChat } from '../utils/slash-dispatch-utils'
import { defaultTableIdForDocumentType } from '../utils/source-icons'
import type {
  UnifiedChatState,
  UnifiedSendMessageOptions,
  StreamingPhase,
} from '../types/unified-chat-state.types'
import type { DialogItem } from '../types/component.types'

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

/** Per-turn metadata extracted from the streamed metadata frame. */
export interface ChatTurnMeta {
  /** Provider key recognized by `<ModelDisplay>` for icon
   *  selection: 'anthropic' | 'openai' | 'google' (case-insensitive). */
  provider: string | null
  modelLabel: string | null
  contextWindowMaxTokens: number | null
  /** Input tokens (from message_start). Includes cached tokens. */
  inputTokens: number | null
  /** Output tokens (from message_delta). Only known after stream end. */
  outputTokens: number | null
  /** Cache hit % (read / total-input × 100). Only known after stream end. */
  cacheHitRatePct: number | null
  /** Cross-call usage breakdown extracted from the trailing usage frame. */
  breakdown: {
    haikuRewriter?: { input: number; output: number }
    haikuClassifier?: { input: number; output: number }
    haikuSummarizer?: { input: number; output: number }
    routedAnswer?: { model: string; complexity: string; thinkingBudget: number }
  } | null
  /** Per-message viewport-positioning hint. */
  scrollAnchor: ScrollAnchor | null
  /** Routing decision from the server's `decideRoute`. */
  routedComplexity: string | null
  routedThinkingBudget: number | null
}

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
 *     This makes Ask / Display work out of the box in embedders without
 *     any callback wiring.
 *
 *     Override only when you have polymorphic / per-tenant document
 *     types that map to a different tableId than the default
 *     (hub-canonical) registry — pass your own `(docType) => tableId`
 *     callback and it wins over the default.
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
// Internal helpers
// =============================================================================

/** Single source of truth for a fresh `ChatTurnMeta` row. */
function createEmptyTurnMeta(): ChatTurnMeta {
  return {
    provider: null,
    modelLabel: null,
    contextWindowMaxTokens: null,
    inputTokens: null,
    outputTokens: null,
    cacheHitRatePct: null,
    breakdown: null,
    scrollAnchor: null,
    routedComplexity: null,
    routedThinkingBudget: null,
  }
}

/**
 * Escape `<` so the lib's `SimpleMarkdownRenderer` (which uses `rehypeRaw`
 * to pass HTML through) doesn't treat XML-like tokens in Claude's
 * thinking output as React components. Escaping `<` → `&lt;` preserves
 * the visible character without breaking blockquote `>` markers.
 */
function escapeThinkingTags(text: string): string {
  return text.replace(/</g, '&lt;')
}

function createDocStreamFn(
  source: DocSource,
  endpoints: { chatStreamUrl: string; approvalToolUrl: string },
  messagesRef: MutableRefObject<Message[]>,
  sourcesMapRef: MutableRefObject<Map<number, ChatSource[]>>,
  refsMapRef: MutableRefObject<Map<number, Record<string, ChatRef>>>,
  metaMapRef: MutableRefObject<Map<number, ChatTurnMeta>>,
  setStreamingPhase: (phase: StreamingPhase) => void,
  bumpMetaTick: () => void,
  sendCountRef: MutableRefObject<number>,
) {
  // CRITICAL: the decoder + buffer MUST live INSIDE the returned async-
  // generator function (per-call closure), NOT at the factory level. A
  // rapid send-stop-send sequence with hook-level state would feed the
  // second stream's first chunk into the first stream's tail buffer,
  // corrupting metadata-frame parsing.
  return async function* (
    message: string,
    signal?: AbortSignal,
    extra?: StreamFnExtraOptions,
  ): AsyncGenerator<MessageSegment> {
    const currentMessages = messagesRef.current || []
    // Filter `hidden:true` messages out of the API history. The approval-
    // action turn injects a hidden user message with `content=''`.
    // `flattenAssistantContent` joins text-segment arrays into a single
    // string so the server sees the receipt + auto-continuation Qs.
    const apiMessages = [
      ...currentMessages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.hidden)
        .map((m) => ({
          role: m.role,
          content:
            typeof m.content === 'string' ? m.content : flattenAssistantContent(m.content),
        })),
      { role: 'user', content: message },
    ]

    // URL + body branch — approvalAction routes to the approval-tool
    // endpoint, the standard chat path routes to the chat-stream endpoint.
    const targetPath = extra?.approvalAction
      ? endpoints.approvalToolUrl
      : endpoints.chatStreamUrl
    // `source` is INTENTIONALLY NOT in the body. The chat route resolves
    // it server-side via its own platform-detection — tamper-proof binding
    // so a client on one platform can't POST a different platform's
    // conversation.
    const requestBody = extra?.approvalAction
      ? {
          proposal_id: extra.approvalAction.proposalId,
          action: extra.approvalAction.action,
          messages: currentMessages
            .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.hidden)
            .map((m) => ({
              role: m.role,
              content:
                typeof m.content === 'string'
                  ? m.content
                  : flattenAssistantContent(m.content),
            })),
        }
      : {
          messages: apiMessages,
          ...(extra?.commandOverride ? { commandOverride: extra.commandOverride } : {}),
          ...(extra?.pendingAttachments && extra.pendingAttachments.length > 0
            ? { pendingAttachments: extra.pendingAttachments }
            : {}),
        }
    // `chatAuthedFetch` carries the bearer-act-as headers (+ Supabase
    // session cookies) — same wrapper `use-chat-attachments` and
    // `use-chat-identity` use, so all three chat-side fetch sites share
    // one identity-propagation primitive.
    const response = await chatAuthedFetch(targetPath, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let inText = false
    // Live thinking accumulator — coalesced to ~20fps to avoid a re-render
    // storm (Anthropic emits 30-60 deltas/sec).
    let thinkingAccum = ''
    let lastThinkingYieldTime = 0
    let pendingThinkingYield = false
    const THINKING_YIELD_INTERVAL_MS = 50
    let trailerBuffer = ''
    let inTrailer = false

    const sendIdx = sendCountRef.current - 1
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })

      if (!inText) {
        buffer += chunk
        while (!inText) {
          const recIdx = buffer.indexOf('\x1E')
          const nullIdx = buffer.indexOf('\0')
          if (recIdx !== -1 && (nullIdx === -1 || recIdx < nullIdx)) {
            if (pendingThinkingYield) {
              pendingThinkingYield = false
              yield { type: 'thinking', text: escapeThinkingTags(thinkingAccum) }
            }
            inText = true
            setStreamingPhase('streaming')
            const after = buffer.slice(recIdx + 1)
            buffer = ''
            if (after) {
              // The `after` slice may ALSO contain the `\x1F` trailing-
              // usage sentinel — common for fixed-answer responses where
              // the whole frame sequence arrives in ONE TCP chunk.
              const unitIdx = after.indexOf('\x1F')
              if (unitIdx === -1) {
                yield { type: 'text', text: after }
              } else {
                const textBefore = after.slice(0, unitIdx)
                const trailerAfter = after.slice(unitIdx + 1)
                if (textBefore) {
                  yield { type: 'text', text: textBefore }
                }
                inTrailer = true
                trailerBuffer = trailerAfter
              }
            }
            break
          }
          if (nullIdx === -1) break // need more bytes
          const metaStr = buffer.slice(0, nullIdx)
          const remaining = buffer.slice(nullIdx + 1)
          let meta: any
          try {
            meta = JSON.parse(metaStr)
          } catch {
            // Not JSON — start of answer body.
            inText = true
            setStreamingPhase('streaming')
            if (buffer.length > 0) {
              yield { type: 'text', text: buffer }
              buffer = ''
            }
            break
          }
          if (meta.status === 'thinking') {
            setStreamingPhase('thinking')
          } else if (meta.kind === 'thinking-delta' && typeof meta.text === 'string') {
            thinkingAccum += meta.text
            const now = Date.now()
            if (now - lastThinkingYieldTime >= THINKING_YIELD_INTERVAL_MS) {
              lastThinkingYieldTime = now
              pendingThinkingYield = false
              yield { type: 'thinking', text: escapeThinkingTags(thinkingAccum) }
            } else {
              pendingThinkingYield = true
            }
          } else if (meta.kind === 'usage' && meta.stage === 'start') {
            mergeTurnMeta(metaMapRef, sendIdx, {
              inputTokens: meta.input_tokens ?? null,
            })
            bumpMetaTick()
          } else if (
            meta.kind === 'decision_resolved' &&
            typeof meta.action === 'string'
          ) {
            // Server-driven post-approve / post-reject frame.
            const action = meta.action === 'rejected' ? 'rejected' : 'approved'
            const toolName =
              typeof meta.tool_name === 'string' ? meta.tool_name : undefined
            const result = (meta.result ?? null) as
              | { ticket_id?: string; status?: string | null; mirror_synced?: boolean }
              | null
            const card = (meta.card ?? null) as
              | { type?: string; marker?: string; ref?: ChatRef }
              | null
            if (card?.ref?.id && card?.type) {
              const existing = refsMapRef.current.get(sendIdx) ?? {}
              const key = buildChatRefKey(card.type, card.ref.id)
              refsMapRef.current.set(sendIdx, { ...existing, [key]: card.ref })
              bumpMetaTick()
            }
            yield {
              type: 'decision_resolved',
              action,
              ok: meta.ok === true,
              willAutoContinue: meta.willAutoContinue === true,
              ...(toolName ? { toolName } : {}),
              ...(result ? { result } : {}),
              ...(card?.marker ? { marker: card.marker } : {}),
              ...(card?.ref ? { cardRef: card.ref } : {}),
              ...(typeof meta.receiptText === 'string'
                ? { receiptText: meta.receiptText }
                : {}),
              proposalId:
                typeof meta.proposalId === 'string' ? meta.proposalId : undefined,
            } as any
          } else if (meta.kind === 'approval_request' && meta.proposalId) {
            // The model called a write tool. Server persisted the
            // proposal and sent us a CARD-READY payload.
            const proposalId = String(meta.proposalId)
            const toolName = String(meta.toolName ?? 'tool')
            const headline =
              typeof meta.title === 'string' && meta.title.length > 0
                ? meta.title
                : toolName
            const rawFields = Array.isArray(meta.fields)
              ? (meta.fields as Array<{ label?: string; value?: string }>)
              : []
            const fields: Array<{ label: string; value: string }> = []
            for (const f of rawFields) {
              if (!f || !f.label || !f.value) continue
              fields.push({ label: f.label, value: f.value })
            }
            yield {
              type: 'approval_request',
              data: {
                command: headline,
                fields,
                requestId: proposalId,
                approvalType: toolName,
              },
              status: 'pending',
            } as any
          } else if (meta.kind === 'text-leading' && typeof meta.text === 'string') {
            // Model's preamble text (the prose written BEFORE the tool_use
            // block) — emitted as a standalone text segment.
            yield { type: 'text', text: meta.text }
          } else if (meta.kind === 'tool_error') {
            const msg =
              typeof meta.message === 'string' && meta.message.length > 0
                ? meta.message
                : 'Could not complete the requested action right now.'
            yield {
              type: 'text',
              text: `⚠️ ${msg}`,
            } as any
          } else if (meta.kind === 'routing') {
            if (typeof meta.routedComplexity === 'string') {
              mergeTurnMeta(metaMapRef, sendIdx, {
                routedComplexity: meta.routedComplexity,
                routedThinkingBudget:
                  typeof meta.routedThinkingBudget === 'number'
                    ? meta.routedThinkingBudget
                    : null,
              })
              bumpMetaTick()
            }
          } else {
            if (meta.sources) {
              sourcesMapRef.current.set(sendIdx, meta.sources)
            }
            // Per-row refs for inline object cards.
            if (meta.refs && typeof meta.refs === 'object') {
              refsMapRef.current.set(sendIdx, meta.refs as Record<string, ChatRef>)
              bumpMetaTick()
            }
            if (
              meta.modelLabel ||
              meta.contextWindowMaxTokens ||
              meta.provider ||
              meta.model
            ) {
              mergeTurnMeta(metaMapRef, sendIdx, {
                provider: meta.provider ?? null,
                modelLabel: meta.modelLabel ?? null,
                contextWindowMaxTokens: meta.contextWindowMaxTokens ?? null,
              })
              bumpMetaTick()
            }
            const parsedAnchor = parseScrollAnchor(meta.scrollAnchor)
            if (parsedAnchor !== null) {
              mergeTurnMeta(metaMapRef, sendIdx, { scrollAnchor: parsedAnchor })
              bumpMetaTick()
            }
          }
          buffer = remaining
        }
      } else if (inTrailer) {
        trailerBuffer += chunk
      } else {
        setStreamingPhase('streaming')
        // Trailing usage frame uses \x1F (Unit Separator) as a sentinel.
        const sepIdx = chunk.indexOf('\x1F')
        if (sepIdx === -1) {
          yield { type: 'text', text: chunk }
        } else {
          const before = chunk.slice(0, sepIdx)
          const after = chunk.slice(sepIdx + 1)
          if (before) yield { type: 'text', text: before }
          inTrailer = true
          trailerBuffer = after
        }
      }
    }
    // Stream ended. Flush any pending thinking text that didn't make it
    // out before the throttle window expired.
    if (pendingThinkingYield) {
      pendingThinkingYield = false
      yield { type: 'thinking', text: escapeThinkingTags(thinkingAccum) }
    }
    // Parse trailer if present.
    if (trailerBuffer.length > 0) {
      try {
        const meta = JSON.parse(trailerBuffer)
        if (
          meta.kind === 'usage' &&
          (meta.stage === 'end' || meta.stage === 'display')
        ) {
          const breakdown =
            meta.breakdown && typeof meta.breakdown === 'object'
              ? {
                  haikuRewriter:
                    meta.breakdown.haikuRewriter &&
                    typeof meta.breakdown.haikuRewriter.input === 'number'
                      ? meta.breakdown.haikuRewriter
                      : undefined,
                  haikuClassifier:
                    meta.breakdown.haikuClassifier &&
                    typeof meta.breakdown.haikuClassifier.input === 'number'
                      ? meta.breakdown.haikuClassifier
                      : undefined,
                  haikuSummarizer:
                    meta.breakdown.haikuSummarizer &&
                    typeof meta.breakdown.haikuSummarizer.input === 'number'
                      ? meta.breakdown.haikuSummarizer
                      : undefined,
                  routedAnswer:
                    meta.breakdown.routedAnswer &&
                    typeof meta.breakdown.routedAnswer.model === 'string'
                      ? meta.breakdown.routedAnswer
                      : undefined,
                }
              : null
          mergeTurnMeta(metaMapRef, sendIdx, {
            inputTokens: meta.input_tokens ?? null,
            outputTokens: meta.output_tokens ?? null,
            cacheHitRatePct:
              typeof meta.hit_rate_pct === 'number' ? meta.hit_rate_pct : null,
            ...(breakdown ? { breakdown } : {}),
          })
          bumpMetaTick()
        }
      } catch {
        // Malformed trailer — silently ignore.
      }
    }
  }
}

/**
 * Merge partial fields into the per-turn meta map. Preserves existing
 * non-null values so a leading frame's data isn't wiped by a later frame
 * that didn't include it.
 */
function mergeTurnMeta(
  ref: MutableRefObject<Map<number, ChatTurnMeta>>,
  sendIdx: number,
  partial: Partial<ChatTurnMeta>,
): void {
  const prev = ref.current.get(sendIdx) ?? createEmptyTurnMeta()
  const filtered = Object.fromEntries(
    Object.entries(partial).filter(([, v]) => v !== undefined && v !== null),
  ) as Partial<ChatTurnMeta>
  ref.current.set(sendIdx, { ...prev, ...filtered })
}

// =============================================================================
// localStorage persistence
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
  // `source` is OPTIONAL — embedders are platform-agnostic (see ChatRuntime.source).
  // Here it's used ONLY for the localStorage history namespace + client-side meta
  // labels; it is NEVER sent on the wire (the hub resolves source server-side via
  // currentPlatform()). Fall back to a stable constant so the persistence key stays
  // well-formed when the embedder leaves source unset.
  const source = runtime.source || DEFAULT_CHAT_SOURCE
  // Fall back to the lib-baked hub-canonical map when the embedder
  // didn't supply an override. Keeps Ask + Display working in any
  // mount that doesn't have a custom documentType registry. Embedders
  // with polymorphic / per-tenant types pass their own callback and it
  // wins.
  const tableIdForDocumentType =
    options?.tableIdForDocumentType ?? defaultTableIdForDocumentType

  // Restore persisted state once on mount.
  const persistedRef = useRef<PersistedChatState | null>(null)
  if (persistedRef.current === null) {
    pruneStaleChatStorage(source)
    persistedRef.current =
      loadPersistedChat(source) || { messages: [], sources: [], sendCount: 0 }
  }

  const sourcesMapRef = useRef<Map<number, ChatSource[]>>(
    new Map(persistedRef.current.sources),
  )
  const refsMapRef = useRef<Map<number, Record<string, ChatRef>>>(
    new Map(persistedRef.current.refs ?? []),
  )
  const metaMapRef = useRef<Map<number, ChatTurnMeta>>(new Map())
  const messagesRef = useRef<Message[]>(persistedRef.current.messages)
  const sendCountRef = useRef(persistedRef.current.sendCount)
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>('idle')
  const [metaTick, setMetaTick] = useState(0)
  const bumpMetaTick = useCallback(() => setMetaTick((t) => t + 1), [])

  const streamFn = useMemo(
    () =>
      createDocStreamFn(
        source,
        {
          chatStreamUrl: runtime.endpoints.chatStreamUrl,
          approvalToolUrl: runtime.endpoints.approvalToolUrl,
        },
        messagesRef,
        sourcesMapRef,
        refsMapRef,
        metaMapRef,
        setStreamingPhase,
        bumpMetaTick,
        sendCountRef,
      ),
    [
      source,
      runtime.endpoints.chatStreamUrl,
      runtime.endpoints.approvalToolUrl,
      bumpMetaTick,
    ],
  )

  // Per-source tableId → slash-command-id lookup, derived from the shared
  // slash-command registry. Used by `displayRef` to translate an
  // inline-card's Display click into a `/<cmd> display "<value>"`
  // invocation, picking the canonical command for the row's RAG table.
  //
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

  // Persist on every messages change. Sources + sendCount live in refs,
  // so we read their current values at write time.
  const persist = useCallback(
    (nextMessages: Message[]) => {
      savePersistedChat(source, {
        messages: nextMessages,
        sources: Array.from(sourcesMapRef.current.entries()),
        refs: Array.from(refsMapRef.current.entries()),
        sendCount: sendCountRef.current,
      })
    },
    [source],
  )

  const {
    messages,
    isTyping,
    isStreaming,
    sendMessage: chatSendMessage,
    stopMessage: chatStopMessage,
    clearMessages: chatClearMessages,
    hasMessages,
  } = useChat({
    useMock: false,
    assistantName: 'Mingo AI',
    streamFn,
    initialMessages: persistedRef.current.messages,
    onMessagesChange: persist,
  })

  messagesRef.current = messages

  // Index sources/refs/scrollAnchor by USER-SEND count (`sendIdx`), not
  // by assistant-message count. Each user send produces exactly ONE
  // refsMapRef entry server-side, but it can produce MULTIPLE assistant
  // messages on the client (main RAG reply + post-approve card +
  // auto-continuation prose). Counting USER sends and mapping every
  // following assistant message to that index keeps the lookup stable.
  let sendIdx = -1
  const docMessages: DocChatMessage[] = messages.map((m) => {
    const segments = Array.isArray(m.content) ? (m.content as MessageSegment[]) : undefined
    const content =
      typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .filter((s) => s.type === 'text')
              .map((s) => (s as { type: 'text'; text: string }).text)
              .join('')
          : ''

    let sources: ChatSource[] | undefined
    let chatRefs: Record<string, ChatRef> | undefined
    let scrollAnchor: ScrollAnchor | undefined
    if (m.role === 'user' && !m.hidden) {
      sendIdx++
    }
    if (m.role === 'assistant') {
      const lookupIdx = sendIdx >= 0 ? sendIdx : 0
      sources = sourcesMapRef.current.get(lookupIdx)
      // The receipt path stamps `chatRefs` directly onto the assistant
      // message in useChat. Prefer that message-bound copy when present;
      // falls back to per-turn refs map.
      chatRefs = m.chatRefs ?? refsMapRef.current.get(lookupIdx)
      scrollAnchor =
        (metaMapRef.current.get(lookupIdx)?.scrollAnchor as ScrollAnchor | null) ??
        undefined
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

  /**
   * Internal sendMessage options — union of the public
   * `UnifiedSendMessageOptions` (semantic fields: `hidden`, `attachments`)
   * and SSE-only internal extras (`commandOverride`, `approvalAction`)
   * set by `discussRef` / `displayRef` / post-approval continuation.
   *
   * The public `UnifiedChatState.sendMessage` accepts only the narrow
   * unified shape; this hook accepts the wider one because internal
   * callers need it. Function-param contravariance makes this assignable.
   */
  type InternalSendMessageOptions = UnifiedSendMessageOptions &
    Pick<StreamFnExtraOptions, 'commandOverride' | 'approvalAction'>

  const sendMessage = useCallback(
    async (
      text: string,
      options?: InternalSendMessageOptions,
    ): Promise<void> => {
      const {
        hidden,
        attachments,
        commandOverride,
        approvalAction,
      } = options ?? {}
      const sseExtras: StreamFnExtraOptions = {
        ...(commandOverride ? { commandOverride } : {}),
        ...(approvalAction ? { approvalAction } : {}),
        ...(attachments && attachments.length > 0
          ? { pendingAttachments: attachments }
          : {}),
      }
      sendCountRef.current++
      setStreamingPhase('thinking')
      await chatSendMessage(text, sseExtras, hidden ? { hidden } : undefined)
    },
    [chatSendMessage],
  )

  /**
   * "Display" callback for inline cards whose registry entry sets
   * `displayAction: true`. Parallel to `discussRef` but emits a
   * `/<cmd> display "<title>"` slash command instead of the Discuss
   * prose. Resolution of the slash command id for the ref's documentType
   * happens via the `cmdIdByTableId` map hydrated from the commands
   * endpoint.
   *
   * `tableIdForDocumentType` is always defined here — either the
   * embedder-supplied override OR the lib-baked
   * `defaultTableIdForDocumentType` fallback. Unknown documentTypes
   * still short-circuit gracefully via the `tableId === null` check
   * below.
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
   *
   * `tableIdForDocumentType` is always defined here — either the
   * embedder-supplied override OR the lib-baked default. Unknown
   * documentTypes still short-circuit via the `tableId === null` check.
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

  const stopMessage = useCallback(() => {
    chatStopMessage()
    setStreamingPhase('idle')
  }, [chatStopMessage])

  const clearMessages = useCallback(() => {
    sourcesMapRef.current.clear()
    refsMapRef.current.clear()
    metaMapRef.current.clear()
    sendCountRef.current = 0
    setStreamingPhase('idle')
    // Force the latestMeta useMemo to recompute with the cleared map.
    bumpMetaTick()
    chatClearMessages()
    // Clear persisted state too so the next mount starts fresh.
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(chatStorageKey(source))
      } catch {}
    }
  }, [chatClearMessages, source, bumpMetaTick])

  // Reset to idle whenever both flags drop off.
  useEffect(() => {
    if (!isTyping && !isStreaming && streamingPhase !== 'idle') {
      setStreamingPhase('idle')
    }
  }, [isTyping, isStreaming, streamingPhase])

  // Resolve the active turn's metadata.
  const latestMeta = useMemo(
    () =>
      metaMapRef.current.get(sendCountRef.current - 1) ??
      metaMapRef.current.get(sendCountRef.current - 2) ??
      null,
    [metaTick, streamingPhase],
  )

  return {
    messages: docMessages,
    isLoading: isTyping || isStreaming,
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
