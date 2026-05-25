'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSSE, type StreamFn, type StreamFnExtraOptions } from './use-sse'
import type {
  Message,
  MessageSegment,
  ToolExecutionData,
} from '../types/message.types'
import { buildChatRefKey } from '../types/chat.types'
import type { ChatRef } from '../chat-ref.types'

export type { Message } from '../types/message.types'
export type { StreamFnExtraOptions } from './use-sse'

interface UseChatOptions {
  useMock?: boolean
  debugMode?: boolean
  assistantName?: string
  assistantAvatar?: string
  /** Custom stream function — bypasses mock/SSE service when provided */
  streamFn?: StreamFn
  /** Initial messages (e.g., restored from localStorage). Evaluated once on mount. */
  initialMessages?: Message[]
  /** Called whenever the messages array changes — use for persistence. */
  onMessagesChange?: (messages: Message[]) => void
}

function isToolSegment(
  segment: MessageSegment,
): segment is { type: 'tool_execution'; data: ToolExecutionData } {
  return segment.type === 'tool_execution'
}

export function useChat({
  useMock = true,
  debugMode = false,
  assistantName = 'Fae',
  assistantAvatar,
  streamFn,
  initialMessages,
  onMessagesChange,
}: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>(() => initialMessages ?? [])
  const [isTyping, setIsTyping] = useState(false)
  const currentAssistantSegmentsRef = useRef<MessageSegment[]>([])

  // Notify the host whenever messages change so it can persist them.
  const onMessagesChangeRef = useRef(onMessagesChange)
  onMessagesChangeRef.current = onMessagesChange
  useEffect(() => {
    onMessagesChangeRef.current?.(messages)
  }, [messages])

  const {
    streamMessage,
    isStreaming,
    error: sseError,
    abort,
    reset,
  } = useSSE({
    useMock,
    debugMode,
    streamFn,
  })

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const updateLastAssistantMessage = useCallback((segments: MessageSegment[]) => {
    setMessages((prev) => {
      const newMessages = [...prev]
      const lastMessage = newMessages[newMessages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant') {
        newMessages[newMessages.length - 1] = {
          ...lastMessage,
          content: segments.length > 0 ? segments : '',
        }
      }
      return newMessages
    })
  }, [])

  const sendMessage = useCallback(
    async (
      text: string,
      extra?: StreamFnExtraOptions,
      /** When `hidden=true` the user message is added to the conversation
       *  history (so the LLM sees it as context) but NOT rendered in the
       *  UI. Used by the host to fire post-approval auto-continuation
       *  turns without polluting the visible thread with synthetic
       *  prompts like "(continue per protocol)". The assistant response
       *  IS rendered normally. */
      options?: { hidden?: boolean },
    ) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        name: 'You',
        content: text,
        timestamp: new Date(),
        ...(options?.hidden ? { hidden: true } : {}),
      }
      addMessage(userMessage)

      setIsTyping(true)
      currentAssistantSegmentsRef.current = []

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        name: assistantName,
        content: [],
        timestamp: new Date(),
        avatar: assistantAvatar,
      }
      addMessage(assistantMessage)

      try {
        let receivedFirstTextChunk = false
        let currentTextSegment = ''

        for await (const segment of streamMessage(text, extra)) {
          // Flip isTyping=false ONLY when the first TEXT segment arrives — NOT
          // on a leading thinking-delta. Reason: <ThinkingDisplay> computes
          // `isStreaming = (index === segments.length - 1 && isTyping)` and
          // switches its label "Thinking" → "Thought" + drops PulseDots when
          // isStreaming is false. If we flipped isTyping on the first thinking
          // delta, the very first thinking chunk would render as "Thought"
          // even while the model is still actively thinking. Holding isTyping
          // true until real text starts keeps the live "Thinking…" UX correct.
          if (!receivedFirstTextChunk && segment.type === 'text') {
            setIsTyping(false)
            receivedFirstTextChunk = true
          }

          if (segment.type === 'text') {
            currentTextSegment += segment.text
            const updatedSegments = [...currentAssistantSegmentsRef.current]

            if (
              updatedSegments.length > 0 &&
              updatedSegments[updatedSegments.length - 1].type === 'text'
            ) {
              updatedSegments[updatedSegments.length - 1] = {
                type: 'text',
                text: currentTextSegment,
              }
            } else {
              updatedSegments.push({ type: 'text', text: currentTextSegment })
            }

            currentAssistantSegmentsRef.current = updatedSegments
            updateLastAssistantMessage(updatedSegments)
          } else if (segment.type === 'thinking') {
            // Adaptive-thinking content from the model. Stash as a single
            // 'thinking' segment at the front of the message; if the segment
            // already exists (server flushed thinking in chunks via the
            // leading-frame loop), replace its text. Order matters: thinking
            // ALWAYS precedes the answer text so the OSS-lib renders the
            // ThinkingDisplay card above the answer body.
            const updatedSegments = [...currentAssistantSegmentsRef.current]
            const existingThinkingIdx = updatedSegments.findIndex(
              (s) => s.type === 'thinking',
            )
            if (existingThinkingIdx !== -1) {
              updatedSegments[existingThinkingIdx] = {
                type: 'thinking',
                text: segment.text,
              }
            } else {
              // Insert at the FRONT so it renders before any text accumulated.
              updatedSegments.unshift({ type: 'thinking', text: segment.text })
            }
            currentAssistantSegmentsRef.current = updatedSegments
            updateLastAssistantMessage(updatedSegments)
          } else if ((segment as any).type === 'approval_request') {
            // Tool proposal from the server. The streamFn pre-wired
            // `onApprove`/`onReject` so they POST to
            // `/api/chat/agent/confirm-tool` with the same proxy auth the
            // chat stream used. Here we (1) flip the card's `status` from
            // pending → approved/rejected after the network round-trip,
            // and (2) append a follow-up TEXT segment so the user sees a
            // concrete confirmation of what happened.
            if (currentTextSegment) {
              const updated = [...currentAssistantSegmentsRef.current]
              if (updated.length > 0 && updated[updated.length - 1].type === 'text') {
                updated[updated.length - 1] = { type: 'text', text: currentTextSegment }
              } else {
                updated.push({ type: 'text', text: currentTextSegment })
              }
              currentAssistantSegmentsRef.current = updated
              currentTextSegment = ''
            }
            const seg = segment as any
            const proposalId: string = seg.data?.requestId
            // Locate the assistant message that hosts this approval
            // segment and apply a transform — INDEPENDENT of
            // `currentAssistantSegmentsRef`, which the SSE `finally`
            // resets to `[]` the moment the stream ends. If we mutated
            // the ref then re-rendered `updateLastAssistantMessage([])`
            // (the empty ref's snapshot), we'd wipe the assistant
            // message's content the instant the user clicks Approve.
            const updateApprovalMessage = (
              transform: (segments: MessageSegment[]) => MessageSegment[],
            ) => {
              setMessages((prev) => {
                for (let i = prev.length - 1; i >= 0; i--) {
                  const m = prev[i]
                  if (m.role !== 'assistant') continue
                  if (!Array.isArray(m.content)) continue
                  const segments = m.content as MessageSegment[]
                  const hasMatch = segments.some(
                    (s) =>
                      (s as any).type === 'approval_request' &&
                      (s as any).data?.requestId === proposalId,
                  )
                  if (!hasMatch) continue
                  const next = [...prev]
                  next[i] = { ...m, content: transform(segments) }
                  return next
                }
                return prev
              })
            }
            // Server-driven post-approve flow: wrappedApprove/Reject just
            // fire a new chat turn with `approvalAction` set. The streamFn
            // routes that turn to `/api/chat/agent/confirm-tool` which
            // returns SSE — its `decision_resolved` leading frame lands
            // back as a `type: 'decision_resolved'` segment in this same
            // loop, where the handler below matches it back to this
            // approval card via `requestId` and applies status flip +
            // receipt append. NO client-side orchestration.
            const wrappedApprove = async (reqId?: string) => {
              if (!reqId) return
              await sendMessage(
                '',
                { approvalAction: { proposalId: reqId, action: 'approve' } },
                { hidden: true },
              )
            }
            const wrappedReject = async (reqId?: string) => {
              if (!reqId) return
              await sendMessage(
                '',
                { approvalAction: { proposalId: reqId, action: 'reject' } },
                { hidden: true },
              )
            }
            currentAssistantSegmentsRef.current.push({
              ...seg,
              onApprove: wrappedApprove,
              onReject: wrappedReject,
            })
            updateLastAssistantMessage([...currentAssistantSegmentsRef.current])
          } else if ((segment as any).type === 'decision_resolved') {
            // Server-driven decision frame from /api/chat/agent/confirm-tool.
            //
            // Two side-effects:
            //
            //   1. SOURCE message (the one carrying the approval card):
            //      flip the matched approval_request segment's status to
            //      'approved'/'rejected'.
            //
            //   2. CURRENT (new) assistant message: prepend the receipt
            //      ("✅ Approved — ticket created: <card>" etc.) into
            //      `currentTextSegment`. Subsequent auto-continuation
            //      text deltas extend the same segment.
            //
            // For reject, no auto-continuation text follows — the new
            // turn carries only the receipt.
            const decision = segment as unknown as {
              type: 'decision_resolved'
              proposalId?: string
              action: 'approved' | 'rejected'
              ok: boolean
              toolName?: string
              result?: { ticket_id?: string; status?: string | null }
              marker?: string
              /** Full ChatRef payload from the server's `decision_resolved`
               *  frame — `card.ref` in the wire format. Carries enough
               *  metadata for inline card render. */
              cardRef?: {
                type?: string
                id?: string
                title?: string
                url?: string | null
                metadata?: Record<string, string | null | undefined>
                [key: string]: unknown
              }
              /** Server-rendered receipt copy. Computed by the per-source
               *  `strategy.tools.receiptRenderer(...)`. */
              receiptText?: string
              /** True when the server WILL stream an auto-continuation
               *  Sonnet turn after this frame. */
              willAutoContinue?: boolean
            }
            if (!decision.proposalId) continue
            // Step 1 — flip the source card's status.
            setMessages((prev) => {
              for (let i = prev.length - 1; i >= 0; i--) {
                const m = prev[i]
                if (m.role !== 'assistant') continue
                if (!Array.isArray(m.content)) continue
                const segments = m.content as MessageSegment[]
                const hasMatch = segments.some(
                  (s) =>
                    (s as any).type === 'approval_request' &&
                    (s as any).data?.requestId === decision.proposalId,
                )
                if (!hasMatch) continue
                const flipped = segments.map((s) =>
                  (s as any).type === 'approval_request' &&
                  (s as any).data?.requestId === decision.proposalId
                    ? ({ ...(s as any), status: decision.action } as MessageSegment)
                    : s,
                )
                const next = [...prev]
                next[i] = { ...m, content: flipped }
                return next
              }
              return prev
            })
            // Step 2 — receipt text into the CURRENT message.
            // SERVER-RENDERED. The per-source strategy
            // (`strategy.tools.receiptRenderer(...)`) computed the copy
            // and shipped it on the SSE frame as `receiptText`. The
            // chat-shell is source-agnostic — it just appends the string.
            const receipt = decision.receiptText ?? null
            if (receipt === null) {
              // No server-provided copy → don't fabricate a fallback.
              continue
            }
            currentTextSegment = receipt + '\n\n'
            const updatedSegments = [...currentAssistantSegmentsRef.current]
            if (
              updatedSegments.length > 0 &&
              updatedSegments[updatedSegments.length - 1].type === 'text'
            ) {
              updatedSegments[updatedSegments.length - 1] = {
                type: 'text',
                text: currentTextSegment,
              }
            } else {
              updatedSegments.push({ type: 'text', text: currentTextSegment })
            }
            currentAssistantSegmentsRef.current = updatedSegments
            // SERVER-DRIVEN CARDREF ATTACHMENT — stamp the ref onto THIS
            // assistant message so the `[card://<type>:<id>]` marker
            // resolves via `message.chatRefs` independent of per-turn
            // refsMap indexing.
            const refForMessage =
              decision.cardRef &&
              typeof decision.cardRef.type === 'string' &&
              typeof decision.cardRef.id === 'string'
                ? decision.cardRef
                : null
            if (refForMessage) {
              const refKey = buildChatRefKey(
                refForMessage.type as string,
                refForMessage.id as string,
              )
              setMessages((prev) => {
                const next = [...prev]
                const lastIdx = next.length - 1
                const lastMsg = next[lastIdx]
                if (!lastMsg || lastMsg.role !== 'assistant') return prev
                next[lastIdx] = {
                  ...lastMsg,
                  content: updatedSegments.length > 0 ? updatedSegments : '',
                  chatRefs: {
                    ...(lastMsg.chatRefs ?? {}),
                    [refKey]: refForMessage as unknown as ChatRef,
                  },
                }
                return next
              })
            } else {
              updateLastAssistantMessage(updatedSegments)
            }
          } else if (segment.type === 'tool_execution') {
            if (currentTextSegment) {
              const updatedSegments = [...currentAssistantSegmentsRef.current]

              if (
                updatedSegments.length > 0 &&
                updatedSegments[updatedSegments.length - 1].type === 'text'
              ) {
                updatedSegments[updatedSegments.length - 1] = {
                  type: 'text',
                  text: currentTextSegment,
                }
              } else {
                updatedSegments.push({ type: 'text', text: currentTextSegment })
              }

              currentAssistantSegmentsRef.current = updatedSegments
              currentTextSegment = ''
            }

            const existingToolIndex = currentAssistantSegmentsRef.current.findIndex(
              (s): s is { type: 'tool_execution'; data: ToolExecutionData } =>
                isToolSegment(s) &&
                s.data.type === 'EXECUTING_TOOL' &&
                s.data.integratedToolType === segment.data.integratedToolType &&
                s.data.toolFunction === segment.data.toolFunction,
            )

            if (existingToolIndex !== -1 && segment.data.type === 'EXECUTED_TOOL') {
              const existingTool = currentAssistantSegmentsRef.current[existingToolIndex] as {
                type: 'tool_execution'
                data: ToolExecutionData
              }
              currentAssistantSegmentsRef.current[existingToolIndex] = {
                ...segment,
                data: {
                  ...segment.data,
                  parameters: segment.data.parameters || existingTool.data.parameters,
                },
              }
            } else {
              currentAssistantSegmentsRef.current.push(segment)
            }

            updateLastAssistantMessage([...currentAssistantSegmentsRef.current])
          }
        }
      } catch (err) {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'error',
          content:
            err instanceof Error
              ? err.message
              : 'An error occurred while processing your request.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev.slice(0, -1), errorMessage])
      } finally {
        setIsTyping(false)
        // Reject-path on confirm-tool emits ONLY a `decision_resolved`
        // leading frame and closes — no text segments stream in, so the
        // placeholder assistant message added by addMessage above would
        // render as a blank bubble. Remove the trailing assistant message
        // if it still has no segments.
        const trailingIsEmpty =
          Array.isArray(currentAssistantSegmentsRef.current) &&
          currentAssistantSegmentsRef.current.length === 0
        if (trailingIsEmpty) {
          setMessages((prev) => {
            if (prev.length === 0) return prev
            const last = prev[prev.length - 1]
            if (last.role !== 'assistant') return prev
            if (Array.isArray(last.content) && last.content.length > 0) return prev
            if (typeof last.content === 'string' && last.content.length > 0) return prev
            return prev.slice(0, -1)
          })
        }
        currentAssistantSegmentsRef.current = []
      }
    },
    [streamMessage, addMessage, updateLastAssistantMessage, assistantName, assistantAvatar],
  )

  const handleQuickAction = useCallback(
    (actionText: string) => {
      sendMessage(actionText)
    },
    [sendMessage],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setIsTyping(false)
    reset()
  }, [reset])

  /**
   * Abort the in-flight streamed message. The fetch's AbortSignal terminates
   * the upstream Anthropic request (so billing stops); the `for await` loop
   * inside `sendMessage` exits via `useSSE`'s AbortError handling, leaving
   * the partial assistant response visible to the user.
   */
  const stopMessage = useCallback(() => {
    abort()
    setIsTyping(false)
  }, [abort])

  return {
    messages,
    isTyping,
    isStreaming,
    error: sseError,
    sendMessage,
    stopMessage,
    handleQuickAction,
    clearMessages,
    hasMessages: messages.length > 0,
  }
}
