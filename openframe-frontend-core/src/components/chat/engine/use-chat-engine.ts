'use client';

/**
 * useChatEngine: THE chat of every live-tail transport (the NATS WebSocket, JetStream, the Tauri bridge), as one
 * `UnifiedChatState`. A host hands it a transport (`ChatTransport`) and a history backend (`ChatHistoryBackend`), and
 * optionally the thread store to keep its threads in.
 *
 *   transport.useLiveTail ─→ catch-up buffer ─→ useChatChunkProcessor ─→ ChatThreadStore (the reducers)
 *   history.fetchDialogMessages ─→ processHistoricalMessages ─→ store.hydrate
 *   transport.publish / stop / approve / reject ←─ the state's commands
 *
 * The store decides how long a thread lives. Without one the engine keeps its own, for the life of the component; a host
 * that hands in a module-level store (`createChatThreadStore`) keeps its threads across unmounts, so a chat reopened
 * mid-turn shows the turn.
 *
 * Two modes, by the presence of `history.fetchDialogs`: with it the engine owns the dialog list and the active dialog
 * (managed); without it the host's `dialogId` is the dialog (bare transport).
 *
 * `active` gates the network work (the tail, the back-fill, the list), so the unified chat can keep an engine mounted for
 * a mode that is not showing. The thread is kept.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { approvalRequestIdOf, type ChatMessage } from '../../../chat-protocol/chat-message';
import type { ChatRef } from '../chat-ref.types';
import { useChunkCatchup } from '../hooks/use-chunk-catchup';
import { useManagedDialogList } from '../hooks/use-managed-dialog-list';
import { CHAT_HISTORY_PAGE_SIZE } from '../mingo-chat-history';
import type { ChatApprovalStatus, ChunkData } from '../types';
import type { ChatMessageActions } from '../types/message.types';
import type {
  ChatConnectionState,
  ChatDialogCapabilities,
  UnifiedChatState,
  UnifiedSendMessageOptions,
} from '../types/unified-chat-state.types';
import { buildDiscussPrompt } from '../utils/discuss-ref-prompt';
import { processHistoricalMessages } from '../utils/process-historical-messages';
import { createChatThreadStore, type ChatThreadStore } from './chat-thread-store';
import type { ChatHistoryBackend, ChatTransport, FetchDialogMessagesResult } from './chat-transport';
import { useChatChunkProcessor } from './use-chat-chunk-processor';
import { useChatThread } from './use-chat-thread';

export interface UseChatEngineConfig {
  transport: ChatTransport;
  history?: ChatHistoryBackend;
  /** Where the threads live. Default: a store of the engine's own, for the life of the component. */
  store?: ChatThreadStore<string>;
  /**
   * The active dialog in bare-transport mode (no `history.fetchDialogs`): the host's, verbatim, `null` for none. Ignored
   * in managed mode, where the engine owns the selection.
   */
  dialogId?: string | null;
  /** Approval tiers drawn as actionable cards (default `['CLIENT']`): another tier's card waits on someone else. */
  displayApprovalTypes?: readonly string[];
  /** The assistant's name on a history page's rows (default 'Mingo'). */
  assistantName?: string;
  /** Only the history rows of this chat type (`ADMIN_AI_CHAT` for Mingo). */
  chatTypeFilter?: string;
  dialogsPageSize?: number;
  messagesPageSize?: number;
  /** The composer's model badge before a turn names one (the host's AI configuration). */
  modelProvider?: string | null;
  modelLabel?: string | null;
}

export interface UseChatEngineOptions {
  /** When false the engine goes idle (no tail, no back-fill, no list); its thread is kept. Default true. */
  active?: boolean;
}

/** The key of the "no dialog selected" thread. */
const DRAFT_DIALOG_KEY = '__draft__';

const DEFAULT_DISPLAY_APPROVAL_TYPES: readonly string[] = ['CLIENT'];

/** The highest persisted stream sequence a hydrated thread holds, or null for none. */
function maxStreamSeq(messages: readonly ChatMessage[]): number | null {
  let max: number | null = null;
  for (const message of messages) {
    const seq = message.metadata?.streamSeq;
    if (typeof seq === 'number' && (max === null || seq > max)) max = seq;
  }
  return max;
}

export function useChatEngine(config: UseChatEngineConfig, options: UseChatEngineOptions = {}): UnifiedChatState {
  const { active = true } = options;
  const {
    transport,
    history = {},
    dialogId: controlledDialogId,
    displayApprovalTypes = DEFAULT_DISPLAY_APPROVAL_TYPES,
    assistantName = 'Mingo',
    chatTypeFilter,
    dialogsPageSize = CHAT_HISTORY_PAGE_SIZE,
    messagesPageSize = 50,
    modelProvider = null,
    modelLabel = null,
  } = config;
  const { fetchDialogs, fetchDialogMessages, fetchArchivedDialogs, unarchiveDialog } = history;

  // The transport and the history as a host passes them, often a new object each render: every command reads them
  // here, so the state's commands keep their identity (the message memo compares `actions` by reference).
  const portsRef = useRef({ transport, history });
  useEffect(() => {
    portsRef.current = { transport, history };
  });

  // ─── Active dialog ────────────────────────────────────────────────────────
  // Capability, not value: with `fetchDialogs` the engine owns the selection, and a `dialogId` passed beside it is
  // ignored. Without it the host's `dialogId` is the dialog, `null` included ("none, idle tail").
  const isManagedMode = fetchDialogs !== undefined;
  const [internalDialogId, setInternalDialogId] = useState<string | null>(null);
  const dialogId = isManagedMode ? internalDialogId : controlledDialogId !== undefined ? controlledDialogId : null;

  // The committed dialog, for async continuations: one whose dialog is no longer active must not touch the new one.
  const currentDialogIdRef = useRef<string | null>(dialogId);
  useEffect(() => {
    currentDialogIdRef.current = dialogId;
  });

  // ─── The thread ───────────────────────────────────────────────────────────
  // Approval statuses are id-keyed and GLOBAL across dialogs (a resolved approval must not come back actionable after a
  // switch), so the engine keeps an instance-lifetime map that tops up every (re)entered dialog.
  const [globalApprovalStatuses] = useState<Record<string, ChatApprovalStatus>>(() => ({}));
  const [ownStore] = useState(() =>
    createChatThreadStore<string>({ options: () => ({ approvalStatuses: globalApprovalStatuses }) }),
  );
  const store = config.store ?? ownStore;
  const dialogKey = dialogId ?? DRAFT_DIALOG_KEY;
  const { state } = useChatThread(store, dialogKey);

  useEffect(() => {
    Object.assign(globalApprovalStatuses, state.approvalStatuses);
  }, [globalApprovalStatuses, state.approvalStatuses]);

  const processChunk = useChatChunkProcessor({ thread: store.bind(dialogKey) });

  // ─── Approvals ────────────────────────────────────────────────────────────
  // Republished from an effect: a click arrives after a commit, so the bodies close over committed values.
  const handleApproveRef = useRef<(requestId: string) => Promise<void>>(async () => {});
  const handleRejectRef = useRef<(requestId: string, reason?: string) => Promise<void>>(async () => {});
  useEffect(() => {
    handleApproveRef.current = async (id: string) => {
      const { approve } = portsRef.current.transport;
      if (!approve) return;
      // An approval hands the turn back to the agent: lock the composer now. Only the click that took the lock may
      // release it on a failure.
      const key = dialogKey;
      const requestId = approvalRequestIdOf(store.snapshotOf(key).messages, id);
      const tookLock = store.mutate(key, r => {
        const took = r.state.streamingPhase === 'idle';
        r.setApprovalStatus(requestId, 'approved');
        if (took) r.setPhase('thinking');
        return took;
      });
      try {
        await approve(requestId);
      } catch (err) {
        store.mutate(key, r => {
          r.setApprovalStatus(requestId, null);
          if (tookLock && r.state.streamingPhase === 'thinking') r.setPhase('idle');
        });
        console.error('[useChatEngine] approve failed:', err);
      }
    };
    handleRejectRef.current = async (id: string, reason?: string) => {
      const { reject } = portsRef.current.transport;
      if (!reject) return;
      // No lock: a rejection keeps the composer free for a correction.
      const key = dialogKey;
      const requestId = approvalRequestIdOf(store.snapshotOf(key).messages, id);
      store.mutate(key, r => r.setApprovalStatus(requestId, 'rejected'));
      try {
        await reject(requestId, reason);
      } catch (err) {
        store.mutate(key, r => r.setApprovalStatus(requestId, null));
        console.error('[useChatEngine] reject failed:', err);
      }
    };
  });

  // ─── Dialog list (managed mode) ───────────────────────────────────────────
  const [isCreatingDialog, setIsCreatingDialog] = useState<boolean>(false);
  const {
    dialogs,
    isDialogsLoading,
    dialogsError,
    hasMoreDialogs,
    reloadDialogs,
    loadMoreDialogs,
    renameDialog,
    archiveDialog,
    deleteDialog,
    upsertDialogTop,
  } = useManagedDialogList({
    autoLoad: active,
    fetchDialogs,
    renameDialog: history.renameDialog,
    archiveDialog: history.archiveDialog,
    deleteDialog: history.deleteDialog,
    pageSize: dialogsPageSize,
    logTag: '[useChatEngine]',
    onDialogRemoved: (id, reason) => {
      if (reason === 'deleted') store.drop(id);
      if (isManagedMode && internalDialogId === id) setInternalDialogId(null);
    },
  });

  // ─── History ──────────────────────────────────────────────────────────────
  // Every page fact is TAGGED with its dialog, so a switch resets them by no longer matching: nothing is written from
  // the switch's effect, and a page of the dialog left can never be read as the new one's.
  const [cursorEntry, setCursorEntry] = useState<{ dialogId: string; cursor: string | null } | null>(null);
  const messagesNextCursor = cursorEntry && cursorEntry.dialogId === dialogId ? cursorEntry.cursor : null;
  /** The dialog whose first page has been read (or failed): until then its history is loading. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  /** Older pages in flight. */
  const [pagesLoading, setPagesLoading] = useState(0);
  const isMessagesLoading =
    (active && !!dialogId && fetchDialogMessages !== undefined && loadedFor !== dialogId) || pagesLoading > 0;
  /** The highest sequence the history held, per dialog: where a replaying tail starts. */
  const [historySeq, setHistorySeq] = useState<{ dialogId: string; seq: number | null } | null>(null);
  // With no history to read, a replaying tail starts at the stream's start.
  const fromSeq = !fetchDialogMessages
    ? null
    : historySeq && historySeq.dialogId === dialogId
      ? historySeq.seq
      : undefined;

  // ─── Connection ───────────────────────────────────────────────────────────
  const [connectedForDialog, setConnectedForDialog] = useState<string | null>(null);
  const hasConnectedOnceRef = useRef(false);

  // The back-fill of a tail that does not replay: chunks emitted while the engine was inactive or before the tail came up.
  const backfills = !transport.replays;
  const {
    processChunk: catchupProcessChunk,
    catchUpChunks,
    startInitialBuffering,
    resetChunkTracking,
    resetAndCatchUp,
    isBufferingActive,
  } = useChunkCatchup({
    dialogId: active && backfills ? dialogId : null,
    onChunkReceived: (chunk: ChunkData) => processChunk(chunk),
    fetchChunks: transport.fetchChunks,
  });

  // Monotonic guard: a slow page for a dialog the user has left must not land on the one they switched to.
  const historyLoadSeqRef = useRef(0);

  /** One page, or `null` when a newer load superseded it, or `'failed'`. Writes nothing: `applyHistoryPage` does. */
  const readHistoryPage = useCallback(
    async (id: string, cursor?: string): Promise<FetchDialogMessagesResult | 'failed' | null> => {
      if (!fetchDialogMessages) return null;
      historyLoadSeqRef.current += 1;
      const seq = historyLoadSeqRef.current;
      try {
        const result = await fetchDialogMessages({ dialogId: id, cursor, limit: messagesPageSize });
        return seq === historyLoadSeqRef.current ? result : null;
      } catch (err) {
        console.error('[useChatEngine] fetchDialogMessages failed:', err);
        return seq === historyLoadSeqRef.current ? 'failed' : null;
      }
    },
    [fetchDialogMessages, messagesPageSize],
  );

  const applyHistoryPage = useCallback(
    (id: string, cursor: string | undefined, page: FetchDialogMessagesResult | 'failed' | null): void => {
      if (page === null) return;
      if (cursor === undefined) setLoadedFor(id);
      if (page === 'failed') {
        if (cursor === undefined) setHistorySeq({ dialogId: id, seq: null });
        return;
      }
      const { messages: processed } = processHistoricalMessages(page.messages, {
        assistantName,
        assistantType: 'mingo',
        chatTypeFilter,
        approvalStatuses: store.snapshotOf(id).state.approvalStatuses,
      });
      if (cursor === undefined) {
        // The first page: THE hydration door. Adoption is armed only while a back-fill is still buffering, the replay
        // that would consume it.
        store.hydrate(id, processed, { expectingReplay: backfills && isBufferingActive() });
        setHistorySeq({ dialogId: id, seq: maxStreamSeq(processed) });
      } else {
        store.mutate(id, r => r.prependMessages(processed));
      }
      if (page.tokenUsage !== undefined) store.mutate(id, r => r.setDialogTokenUsage(page.tokenUsage ?? null));
      setCursorEntry({ dialogId: id, cursor: page.nextCursor });
    },
    [store, assistantName, chatTypeFilter, isBufferingActive, backfills],
  );

  const loadDialogHistory = useCallback(
    (id: string, cursor?: string): Promise<void> =>
      readHistoryPage(id, cursor).then(page => applyHistoryPage(id, cursor, page)),
    [readHistoryPage, applyHistoryPage],
  );

  // Reset and reload when the active dialog changes.
  const prevDialogIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevDialogIdRef.current === dialogId) return;
    prevDialogIdRef.current = dialogId;
    // Invalidates an in-flight page of the previous dialog, the clear path too.
    historyLoadSeqRef.current += 1;
    // A clean slate for the (re)entered dialog; the statuses survive, topped up with the global map (the reducer's
    // precedence: what the stream learned wins).
    store.restart(dialogKey);
    store.mergeApprovalStatuses(dialogKey, globalApprovalStatuses);
    if (!active || !dialogId) return;
    void loadDialogHistory(dialogId);
  }, [active, dialogId, dialogKey, store, globalApprovalStatuses, loadDialogHistory]);

  // The initial back-fill of a fresh dialog, beside the history: it buffers the raw chunks the tail may have missed.
  useEffect(() => {
    if (!active || !dialogId || !backfills) return;
    // A dead tail replays its APPROVAL_RESULT / EXECUTING_TOOL chunks on every open, and its releasing MESSAGE_END
    // never replays: the agent-busy lock is suppressed for the replay window (a counter: windows can overlap).
    store.mutate(dialogId, r => r.adjustAgentBusySuppression(1));
    resetChunkTracking();
    startInitialBuffering();
    catchUpChunks()
      .catch((err: unknown) => {
        console.error('[useChatEngine] initial catchup failed:', err);
      })
      .finally(() => {
        store.mutate(dialogId, r => {
          r.adjustAgentBusySuppression(-1);
          // A replay that produced no MESSAGE_START must not leave adoption armed for the next genuine turn.
          r.armAdoptTrailingAssistant(false);
        });
      });
  }, [active, dialogId, store, backfills, resetChunkTracking, startInitialBuffering, catchUpChunks]);

  // A reconnect of a tail that does not replay: the history first (direct messages are never in the chunk back-fill),
  // then the chunk tail over it, with live deliveries buffered for the whole of it.
  const handleConnect = () => {
    if (!backfills) return;
    if (!hasConnectedOnceRef.current) {
      hasConnectedOnceRef.current = true;
      return;
    }
    const reconnectDialogId = dialogId;
    if (reconnectDialogId) store.mutate(reconnectDialogId, r => r.adjustAgentBusySuppression(1));
    startInitialBuffering();
    void (async () => {
      try {
        if (reconnectDialogId && fetchDialogMessages) await loadDialogHistory(reconnectDialogId);
        if (reconnectDialogId !== currentDialogIdRef.current) return;
        await resetAndCatchUp();
      } catch (err) {
        console.error('[useChatEngine] reconnect catchup failed:', err);
      } finally {
        if (reconnectDialogId) {
          store.mutate(reconnectDialogId, r => {
            r.adjustAgentBusySuppression(-1);
            // The replayed START was consumed live and is skipped by the replay: clear adoption.
            r.armAdoptTrailingAssistant(false);
          });
        }
      }
    })();
  };

  transport.useLiveTail({
    enabled: active && dialogId != null,
    dialogId,
    fromSeq,
    onEvent: (payload, messageType) => {
      // Through the back-fill buffer, so its dedupe sees the live tail too; a replaying tail goes straight in.
      if (backfills) catchupProcessChunk(payload as ChunkData, messageType);
      else processChunk(payload);
      setConnectedForDialog(currentDialogIdRef.current ?? null);
    },
    onConnect: handleConnect,
    onResync: () => {
      if (dialogId) void loadDialogHistory(dialogId);
    },
  });

  // "connecting" until the dialog's tail has produced an event; derived, so a switch reads "connecting" on its own.
  const connectionState: ChatConnectionState =
    !active || !dialogId ? 'connected' : connectedForDialog === dialogId ? 'connected' : 'connecting';

  // ─── Commands ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, sendOptions?: UnifiedSendMessageOptions): Promise<void> => {
      const hidden = sendOptions?.hidden ?? false;
      // The bubble, its placeholder, the echo it expects and the phase: all the reducer's.
      store.pushOptimisticSend(dialogKey, text, { hidden });
      await portsRef.current.transport.publish(text, { ...sendOptions, hidden, dialogId });
    },
    [store, dialogKey, dialogId],
  );

  const stopMessage = useCallback(() => {
    store.mutate(dialogKey, r => r.setPhase('idle'));
    const { stop } = portsRef.current.transport;
    if (stop && dialogId) {
      void stop(dialogId).catch((err: unknown) => {
        console.error('[useChatEngine] stop failed:', err);
      });
    }
  }, [store, dialogKey, dialogId]);

  const clearMessages = useCallback(() => {
    store.mutate(dialogKey, r => r.clearThread());
  }, [store, dialogKey]);

  const selectDialog = useCallback(
    (id: string | null) => {
      // Bare transport: the host owns the selection.
      if (isManagedMode) setInternalDialogId(id);
    },
    [isManagedMode],
  );

  const startNewDialog = useCallback(async (): Promise<string | null> => {
    const { createDialog } = portsRef.current.history;
    if (!createDialog || isCreatingDialog) return null;
    try {
      setIsCreatingDialog(true);
      const result = await createDialog();
      // The list shows the new conversation at once; the next refresh replaces it with the real entry.
      upsertDialogTop({ id: result.dialogId, title: 'New Chat', timestamp: new Date() });
      if (isManagedMode) setInternalDialogId(result.dialogId);
      return result.dialogId;
    } catch (err) {
      console.error('[useChatEngine] createDialog failed:', err);
      return null;
    } finally {
      setIsCreatingDialog(false);
    }
  }, [isCreatingDialog, isManagedMode, upsertDialogTop]);

  const loadMoreMessages = useCallback(async (): Promise<void> => {
    if (!dialogId || !messagesNextCursor) return;
    setPagesLoading(count => count + 1);
    try {
      await loadDialogHistory(dialogId, messagesNextCursor);
    } finally {
      setPagesLoading(count => count - 1);
    }
  }, [dialogId, messagesNextCursor, loadDialogHistory]);

  const logSendFailure = useCallback((err: unknown) => {
    // A card or a chip has no composer promise for the rejection to surface through.
    console.error('[useChatEngine] send failed:', err);
  }, []);

  // An escalation answer is offered only when the transport has one; the presence, not the function, is the capability.
  const canApproveEscalation = transport.approveEscalation !== undefined;
  const canRejectEscalation = transport.rejectEscalation !== undefined;
  // What a message's controls do: a stable object, the message memo compares it by reference.
  const actions = useMemo<ChatMessageActions>(
    () => ({
      approve: id => handleApproveRef.current(id),
      reject: (id, reason) => handleRejectRef.current(id, reason),
      ...(canApproveEscalation
        ? { approveEscalation: (offerId: string) => portsRef.current.transport.approveEscalation?.(offerId) }
        : {}),
      ...(canRejectEscalation
        ? { rejectEscalation: (offerId: string) => portsRef.current.transport.rejectEscalation?.(offerId) }
        : {}),
      selectAsk: label => void sendMessage(label).catch(logSendFailure),
      pickSuggestion: prompt => void sendMessage(prompt).catch(logSendFailure),
    }),
    [canApproveEscalation, canRejectEscalation, sendMessage, logSendFailure],
  );

  // "Ask" on a card: the agent has no record-filtered retrieval, so the prompt names the record and the agent reads it.
  const discussRef = useCallback(
    (reference: ChatRef) => {
      void sendMessage(buildDiscussPrompt(reference, { includeReference: true })).catch(logSendFailure);
    },
    [sendMessage, logSendFailure],
  );

  const { messages, streamingPhase, writingMessageId, dialogTokenUsage = null, liveModel = null } = state;
  const isLoading = streamingPhase !== 'idle';
  const hasMoreMessages = messagesNextCursor != null;

  // Always present: this engine's panel owns a dialog list. Each field is gated on its own callback.
  const dialogCapabilities = useMemo<ChatDialogCapabilities>(
    () => ({
      canRename: isManagedMode && !!history.renameDialog,
      canArchive: isManagedMode && !!history.archiveDialog,
      fetchArchivedDialogs: isManagedMode ? fetchArchivedDialogs : undefined,
      unarchiveDialog: isManagedMode ? unarchiveDialog : undefined,
    }),
    [isManagedMode, history.renameDialog, history.archiveDialog, fetchArchivedDialogs, unarchiveDialog],
  );

  return useMemo<UnifiedChatState>(
    () => ({
      messages,
      actions,
      displayApprovalTypes,
      isLoading,
      streamingPhase,
      writingMessageId,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
      // The model: a live `message-metadata` chunk, else the host's baseline. Tokens: the dialog's usage.
      currentProvider: liveModel?.provider ?? modelProvider ?? null,
      currentModelLabel: liveModel?.modelLabel ?? modelLabel ?? null,
      currentContextWindowMaxTokens: dialogTokenUsage?.contextSize ?? liveModel?.contextWindowMaxTokens ?? null,
      currentInputTokens: dialogTokenUsage?.inputTokensSize ?? null,
      currentOutputTokens: dialogTokenUsage?.outputTokensSize ?? null,
      currentCacheHitRatePct: null,
      currentUsageBreakdown: null,
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
      dialogCapabilities,
      dialogTokenUsage,
      connectionState,
    }),
    [
      messages,
      actions,
      displayApprovalTypes,
      isLoading,
      streamingPhase,
      writingMessageId,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
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
      dialogCapabilities,
      dialogTokenUsage,
      liveModel,
      modelProvider,
      modelLabel,
      connectionState,
    ],
  );
}
