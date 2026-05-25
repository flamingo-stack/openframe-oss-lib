'use client'

import { useState, useCallback, useRef } from 'react'
import type { MessageSegment } from '../types/message.types'
import type { WireCommandOverride } from '../utils/slash-dispatch-utils'
import type { ChatAttachment } from '../utils/chat-attachment-markdown'

/**
 * Stream function signature. The optional `signal` is created fresh per
 * `streamMessage` call so the underlying fetch can be aborted cleanly when
 * the user clicks Stop. Without the signal, abort would only stop yielding
 * chunks at the iterator boundary while the upstream Anthropic request
 * continued running (and billing).
 *
 * `extraOptions` carries per-call extras (currently `commandOverride` for
 * the inline-card "Discuss" affordance per v6.1 §B.2.8). Kept generic so
 * future per-call wire fields don't bloat the signature.
 */
export interface StreamFnExtraOptions {
  commandOverride?: WireCommandOverride
  /** Out-of-band signal for the post-approval / post-reject
   *  server-driven turn. When set, the streamFn routes to
   *  `/api/chat/agent/confirm-tool` instead of `/api/docs/chat` and
   *  encodes the action on the request body. The server emits a
   *  `decision_resolved` leading frame that the chat-shell uses to
   *  flip the SOURCE approval card (different assistant message than
   *  the one being streamed into), then — on approve + write tool —
   *  pipes the auto-continuation Sonnet response as standard chat SSE
   *  frames into a NEW assistant turn. The CLIENT does not orchestrate
   *  the auto-continuation; it just renders frames. */
  approvalAction?: {
    proposalId: string
    action: 'approve' | 'reject'
  }
  /** Chat-attachment payload riding alongside the user's text — the
   *  staged attachments produced by `useChatAttachments`. Server-side,
   *  `runDocsChat` strips the embedded `/api/storage/view/chat-attachments/...`
   *  markdown lines from the user's text and replaces them with
   *  Anthropic image content blocks (raw signed URLs).
   *
   *  Wire format: `storagePath` + `viewToken` only — NEVER a `url`
   *  field. Server validates against `ChatAttachmentSchema` and rejects
   *  malformed shapes. */
  pendingAttachments?: ChatAttachment[]
}
export type StreamFn = (
  message: string,
  signal?: AbortSignal,
  extra?: StreamFnExtraOptions,
) => AsyncGenerator<MessageSegment>

interface UseSSEOptions {
  useMock?: boolean
  debugMode?: boolean
  /** Custom stream function — when provided, bypasses the mock fallback */
  streamFn?: StreamFn
}

export function useSSE({ useMock = true, debugMode = false, streamFn }: UseSSEOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Lib-side mock fallback — useDocChat ALWAYS sets `useMock: false`,
  // so this path is unreachable in production usage. Kept as a clear
  // error so any future caller that flips `useMock: true` without
  // providing a `streamFn` gets a loud signal instead of a silent
  // misroute. Hub-side wrappers that need the mock can supply their
  // own streamFn from a MockChatService.
  const fallbackStream = useCallback(async function* (): AsyncGenerator<MessageSegment> {
    throw new Error(
      '[useSSE] No streamFn provided and `useMock: true` is no longer wired into the lib. ' +
        'Supply a `streamFn` (see `createDocStreamFn` in use-embedded-chat) or migrate the ' +
        'mock to your host code.',
    )
  }, [])

  const streamMessage = useCallback(
    async function* (
      message: string,
      extra?: StreamFnExtraOptions,
    ): AsyncGenerator<MessageSegment> {
      setIsStreaming(true)
      setError(null)

      // Create a fresh AbortController for this stream. abort() targets it via
      // the ref; the signal is passed THROUGH to streamFn so the underlying
      // fetch (and Anthropic upstream) terminates on Stop.
      const ctrl = new AbortController()
      abortControllerRef.current = ctrl

      try {
        const generator = streamFn
          ? streamFn(message, ctrl.signal, extra)
          : fallbackStream()

        for await (const chunk of generator) {
          // Check if aborted
          if (ctrl.signal.aborted) {
            break
          }
          yield chunk
        }
      } catch (err) {
        // AbortError on user-initiated stop is expected — surface as a no-error
        // path so the consumer's catch doesn't render a red error message.
        if ((err as any)?.name === 'AbortError' || ctrl.signal.aborted) {
          return
        }
        const errorMessage = err instanceof Error ? err.message : 'An error occurred'
        setError(errorMessage)
        throw err
      } finally {
        setIsStreaming(false)
        // Only clear the ref if it still points at this controller (defensive
        // — a rapid send-stop-send sequence might have already replaced it).
        if (abortControllerRef.current === ctrl) {
          abortControllerRef.current = null
        }
      }
    },
    [streamFn, fallbackStream],
  )

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    // Reset state if needed
  }, [])

  return {
    streamMessage,
    isStreaming,
    error,
    abort,
    reset,
  }
}
