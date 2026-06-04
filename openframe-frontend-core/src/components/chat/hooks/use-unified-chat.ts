'use client'

/**
 * useUnifiedChat — the single public entry point for the unified chat
 * surface. Dispatches between the SSE/Guide and NATS/Mingo transport
 * adapters based on the active mode. Always calls both underlying
 * hooks (React rules of hooks) but only one is "live": the inactive
 * one stays idle (no streams, no subscriptions) while preserving its
 * local message buffer so a mode-flip restores the user to exactly
 * where they left off.
 *
 * Consumers that only need one mode pass a single `modes` entry —
 * the inactive adapter's config slot stays empty and the hook
 * supplies a no-op default so React-hooks-rules are satisfied
 * without forcing consumers to write throwaway stubs.
 *
 * The mode-toggle UI affordance lives in the `<MingoChat>` shell that
 * consumes this hook, NOT here. This module is pure state plumbing.
 */

import { useCallback, useMemo, useRef } from 'react'
import { useSseChatAdapter, type UseSseChatAdapterOptions } from './use-sse-chat-adapter'
import {
  useNatsChatAdapter,
  type UseNatsChatAdapterConfig,
} from './use-nats-chat-adapter'
import type { UnifiedChatState } from '../types/unified-chat-state.types'

// =============================================================================
// Modes
// =============================================================================

/** Discriminator for the active transport mode. */
export type ChatMode = 'guide' | 'mingo'

/**
 * Per-mode configuration. Each slot is optional — consumers that only
 * need one mode leave the other undefined. The active mode MUST have
 * its config populated; passing `activeMode: 'mingo'` while `modes.mingo`
 * is undefined is a programming error and surfaces as a thrown
 * `sendMessage`.
 */
export interface UseUnifiedChatModes {
  /**
   * Guide mode (SSE → hub). Currently `useSseChatAdapter` reads its
   * config from the ambient `ChatRuntimeContext` rather than props,
   * so this slot is just an opt-in flag plus its adapter options.
   * The presence of the key signals "guide mode is configured".
   */
  guide?: UseSseChatAdapterOptions

  /**
   * Mingo mode (NATS → openframe). All wiring is explicit: dialog id,
   * NATS URL builder, publish callback, optional catchup fetcher.
   * See `UseNatsChatAdapterConfig` for the field-by-field contract.
   */
  mingo?: UseNatsChatAdapterConfig
}

export interface UseUnifiedChatOptions {
  modes: UseUnifiedChatModes
  activeMode: ChatMode

  /**
   * Pre-built Mingo-mode state, supplied by the host instead of letting
   * the internal `useNatsChatAdapter` own it. When provided AND the active
   * mode is `'mingo'`, this object is used verbatim as the active state and
   * the internal NATS adapter stays idle (the host should also omit
   * `modes.mingo` so no live subscription is opened here).
   *
   * This is the seam that lets a host keep chat data/streaming in its own
   * store + cache (so it survives the panel unmounting) rather than in this
   * hook's local React state. Guide mode is unaffected.
   */
  mingoStateOverride?: UnifiedChatState
}

// =============================================================================
// Defaults — fill the inactive slot so both hooks run safely
// =============================================================================

const EMPTY_SSE_OPTIONS: UseSseChatAdapterOptions = {}

function createDisabledNatsConfig(): UseNatsChatAdapterConfig {
  return {
    dialogId: null,
    getNatsWsUrl: () => null,
    publishUserMessage: () => {
      throw new Error(
        '[useUnifiedChat] publishUserMessage invoked but mingo mode is not configured. ' +
          'Pass `modes.mingo` to enable Mingo agent transport.',
      )
    },
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useUnifiedChat(
  options: UseUnifiedChatOptions,
): UnifiedChatState {
  const { modes, activeMode, mingoStateOverride } = options

  // The mingo config object identity matters — `useNatsChatAdapter`
  // wires its `dialogId`/url/publish into deps. Stabilise the disabled
  // fallback so a guide-only consumer doesn't churn NATS hook state
  // every render.
  const disabledNatsRef = useRef<UseNatsChatAdapterConfig | null>(null)
  if (disabledNatsRef.current === null) {
    disabledNatsRef.current = createDisabledNatsConfig()
  }

  // Each adapter receives the user's config OR the disabled fallback,
  // plus an `active` flag that gates its live network work. Both
  // hooks are always called — only one is doing real work.
  const sseActive = activeMode === 'guide' && modes.guide !== undefined
  const natsActive = activeMode === 'mingo' && modes.mingo !== undefined

  const sseState = useSseChatAdapter(modes.guide ?? EMPTY_SSE_OPTIONS, {
    active: sseActive,
  })
  const natsState = useNatsChatAdapter(
    modes.mingo ?? disabledNatsRef.current,
    { active: natsActive },
  )

  // Host-injected Mingo state wins when present: the internal `natsState`
  // still runs (rules of hooks) but is idle (no `modes.mingo` → not active),
  // and we hand the host's store-backed state straight through as active.
  const activeState =
    activeMode === 'guide'
      ? sseState
      : (mingoStateOverride ?? natsState)

  // Re-wrap so the returned identity is stable for the active state.
  // Consumers shouldn't see the inactive adapter's state at all.
  const stopMessage = useCallback(() => activeState.stopMessage(), [activeState])
  const clearMessages = useCallback(
    () => activeState.clearMessages(),
    [activeState],
  )
  const sendMessage = useCallback(
    (text: string, opts?: Parameters<UnifiedChatState['sendMessage']>[1]) =>
      activeState.sendMessage(text, opts),
    [activeState],
  )
  const discussRef = useCallback(
    (ref: Parameters<UnifiedChatState['discussRef']>[0]) =>
      activeState.discussRef(ref),
    [activeState],
  )
  const displayRef = useCallback(
    (ref: Parameters<UnifiedChatState['displayRef']>[0]) =>
      activeState.displayRef(ref),
    [activeState],
  )

  // Dialog-management forwards — one thin wrapper per action so the
  // returned identity stays stable as long as the active adapter's
  // identity does. We don't recreate per-call to avoid spurious child
  // re-renders downstream.
  const selectDialog = useCallback(
    (id: string | null) => activeState.selectDialog(id),
    [activeState],
  )
  const startNewDialog = useCallback(
    () => activeState.startNewDialog(),
    [activeState],
  )
  const deleteDialog = useCallback(
    (id: string) => activeState.deleteDialog(id),
    [activeState],
  )
  const renameDialog = useCallback(
    (id: string, title: string) => activeState.renameDialog(id, title),
    [activeState],
  )
  const archiveDialog = useCallback(
    (id: string) => activeState.archiveDialog(id),
    [activeState],
  )
  const loadMoreDialogs = useCallback(
    () => activeState.loadMoreDialogs(),
    [activeState],
  )
  const reloadDialogs = useCallback(
    () => activeState.reloadDialogs(),
    [activeState],
  )
  const loadMoreMessages = useCallback(
    () => activeState.loadMoreMessages(),
    [activeState],
  )
  const approveRequest = useCallback(
    (requestId: string) => activeState.approveRequest(requestId),
    [activeState],
  )
  const rejectRequest = useCallback(
    (requestId: string, reason?: string) =>
      activeState.rejectRequest(requestId, reason),
    [activeState],
  )

  return useMemo<UnifiedChatState>(
    () => ({
      messages: activeState.messages,
      isLoading: activeState.isLoading,
      streamingPhase: activeState.streamingPhase,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
      displayRef,
      currentProvider: activeState.currentProvider,
      currentModelLabel: activeState.currentModelLabel,
      currentContextWindowMaxTokens: activeState.currentContextWindowMaxTokens,
      currentInputTokens: activeState.currentInputTokens,
      currentOutputTokens: activeState.currentOutputTokens,
      currentCacheHitRatePct: activeState.currentCacheHitRatePct,
      currentUsageBreakdown: activeState.currentUsageBreakdown,
      // Dialog management (forwarded from active adapter)
      dialogs: activeState.dialogs,
      activeDialogId: activeState.activeDialogId,
      selectDialog,
      startNewDialog,
      deleteDialog,
      renameDialog,
      archiveDialog,
      isDialogsLoading: activeState.isDialogsLoading,
      dialogsError: activeState.dialogsError,
      reloadDialogs,
      isMessagesLoading: activeState.isMessagesLoading,
      hasMoreDialogs: activeState.hasMoreDialogs,
      loadMoreDialogs,
      hasMoreMessages: activeState.hasMoreMessages,
      loadMoreMessages,
      // Approvals
      approveRequest,
      rejectRequest,
      // Token usage + connection
      dialogTokenUsage: activeState.dialogTokenUsage,
      connectionState: activeState.connectionState,
    }),
    [
      activeState,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
      displayRef,
      selectDialog,
      startNewDialog,
      deleteDialog,
      renameDialog,
      archiveDialog,
      loadMoreDialogs,
      reloadDialogs,
      loadMoreMessages,
      approveRequest,
      rejectRequest,
    ],
  )
}
