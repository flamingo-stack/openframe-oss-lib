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
 * Who owns the active dialog: with `history.fetchDialogs` the engine owns the list and the selection (managed); without
 * it a host that passes `dialogId` owns the selection (controlled), and one that does not leaves it to the engine
 * (`selectDialog`), a window that shows one dialog at a time (the Fae client).
 *
 * Everything a chat does with a dialog is here, once, and a host only names what its backend can do: the list with its
 * server-side search and owner scope (`dialogScopes`), the open dialog's record and why it could not be read
 * (`fetchDialog`, `dialogError`), a dialog created on the first send or for a launcher (`createDialog`,
 * `startNewDialog`), the composer lock of a compaction, a publish that waits for the tail (`awaitsSubscription`), the
 * optimistic answers of approvals and escalation offers, and a failed send's row.
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
import type { DialogItem } from '../types/component.types';
import type { ChatMessageActions } from '../types/message.types';
import type {
  ChatConnectionState,
  ChatDialogCapabilities,
  ChatNewDialogOptions,
  UnifiedChatState,
  UnifiedSendMessageOptions,
} from '../types/unified-chat-state.types';
import { buildDiscussPrompt } from '../utils/discuss-ref-prompt';
import { isCompactingTail } from '../utils/extract-incomplete-message-state';
import { processHistoricalMessages } from '../utils/process-historical-messages';
import {
  findLatestPendingId,
  pendingApprovalIdOf,
  pendingOfferIdOf,
  withThreadAuthor,
  type ThreadAuthorNames,
} from '../utils/thread-display';
import { createChatThreadStore, type ChatThreadStore } from './chat-thread-store';
import type { ChatDialogRecord, ChatHistoryBackend, ChatTransport, FetchDialogMessagesResult } from './chat-transport';
import {
  useChatChunkProcessor,
  type ChatChunkObservers,
  type ChatDirectMessageRules,
} from './use-chat-chunk-processor';
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
  /** The assistant's face on a history page's rows. */
  assistantAvatar?: string;
  /**
   * The thread as drawn: a row with no author is the assistant's (its name and face), the viewer's own (`names.own`) or
   * another person's (`names.other`, a technician). Omitted, rows are drawn as the reducer wrote them.
   */
  authors?: { assistant: { name: string | undefined; avatar: string | undefined }; names: ThreadAuthorNames };
  /** The list is filtered by owner on the server: the viewer's dialogs (`'my'`, the default) or everyone's. */
  dialogScopes?: boolean;
  /** The signed-in viewer's id: opening a dialog someone else owns moves the list to everyone's, which can list it. */
  currentUserId?: string;
  /** What the assistant says first in a dialog this chat creates to send into (its greeting). */
  newDialogGreeting?: string;
  /** What a chunk tells the host beside the thread, and the direct-message rules of a chat a person can write into. */
  observers?: ChatChunkObservers;
  directMessages?: ChatDirectMessageRules;
  /** A raw live chunk before it is decoded (a host's own title for a tool row). */
  transformChunk?: (raw: unknown) => unknown;
  /** Sending over a pending approval rejects it and over a pending escalation offer cancels it, as the backend does. */
  sendSupersedesPending?: boolean;
  /** What a failed send leaves in the thread: a sentence, or null for nothing (a dropped connection). Default its message. */
  sendFailureText?: (error: unknown) => string | null;
  /** A card's answer failed and its optimistic flip was put back. */
  onActionError?: (action: ChatEngineAction, error: unknown) => void;
  /** Log what each chunk became. Read on every chunk. */
  debug?: () => boolean;
}

/** A card's answer the engine sends. */
export type ChatEngineAction = 'approve' | 'reject' | 'approveEscalation' | 'rejectEscalation';

export interface UseChatEngineOptions {
  /** When false the engine goes idle (no tail, no back-fill, no list); its thread is kept. Default true. */
  active?: boolean;
}

/** The key of the "no dialog selected" thread. */
const DRAFT_DIALOG_KEY = '__draft__';

/** How long a send waits for the tail to subscribe to its dialog (`awaitsSubscription`). */
const SUBSCRIPTION_WAIT_MS = 30_000;

/** What a dialog the list has not named yet is called. */
const NEW_DIALOG_TITLE = 'New Chat';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The open dialog's record, as read for one dialog: absent while it is read, null when it did not resolve. */
interface DialogRecordEntry {
  dialogId: string;
  record: ChatDialogRecord | null;
  error: string | null;
}

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
    assistantAvatar,
    authors,
    dialogScopes = false,
    currentUserId,
    newDialogGreeting,
    observers,
    directMessages,
    transformChunk,
    sendSupersedesPending = false,
    sendFailureText = errorText,
    onActionError,
    debug,
  } = config;
  const { fetchDialogs, fetchDialogMessages, fetchArchivedDialogs, unarchiveDialog } = history;

  // The transport and the history as a host passes them, often a new object each render: every command reads them
  // here, so the state's commands keep their identity (the message memo compares `actions` by reference).
  const portsRef = useRef({ transport, history, sendFailureText, onActionError, transformChunk });
  useEffect(() => {
    portsRef.current = { transport, history, sendFailureText, onActionError, transformChunk };
  });

  // ─── Active dialog ────────────────────────────────────────────────────────
  // Capability, not value: with `fetchDialogs` the engine owns the selection, and a `dialogId` passed beside it is
  // ignored. Without it a host that passes `dialogId` owns it, `null` included ("none, idle tail"); one that does not
  // leaves it to the engine.
  const isManagedMode = fetchDialogs !== undefined;
  const isControlled = !isManagedMode && controlledDialogId !== undefined;
  const [internalDialogId, setInternalDialogId] = useState<string | null>(null);
  const dialogId = isControlled ? (controlledDialogId ?? null) : internalDialogId;

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

  const processChunk = useChatChunkProcessor({
    thread: store.bind(dialogKey),
    ...(observers ? { observers } : {}),
    ...directMessages,
    ...(debug ? { debug } : {}),
  });

  // ─── Approvals ────────────────────────────────────────────────────────────
  // Republished from an effect: a click arrives after a commit, so the bodies close over committed values.
  const handleApproveRef = useRef<(requestId: string) => Promise<void>>(async () => {});
  const handleRejectRef = useRef<(requestId: string, reason?: string) => Promise<void>>(async () => {});
  const handleOfferRef = useRef<(offerId: string, approve: boolean) => Promise<void>>(async () => {});
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
        portsRef.current.onActionError?.('approve', err);
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
        portsRef.current.onActionError?.('reject', err);
      }
    };
    // An offer resolves on the click, for the same reason: a failure puts it back as it was, asking again.
    handleOfferRef.current = async (offerId: string, approve: boolean) => {
      const { approveEscalation, rejectEscalation } = portsRef.current.transport;
      const answer = approve ? approveEscalation : rejectEscalation;
      if (!answer) return;
      const key = dialogKey;
      store.mutate(key, r => r.projectApprovalResolution(offerId, approve ? 'approved' : 'rejected'));
      try {
        await answer(offerId);
      } catch (err) {
        store.mutate(key, r => {
          r.projectApprovalResolution(offerId, 'pending');
          r.setApprovalStatus(offerId, null);
        });
        console.error('[useChatEngine] escalation answer failed:', err);
        portsRef.current.onActionError?.(approve ? 'approveEscalation' : 'rejectEscalation', err);
      }
    };
  });

  // ─── Dialog list (managed mode) ───────────────────────────────────────────
  const [isCreatingDialog, setIsCreatingDialog] = useState<boolean>(false);
  // The list's server-side search and owner scope: a change of either reloads its first page.
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogScope, setDialogScope] = useState<'my' | 'all'>('my');
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
    search: searchQuery || undefined,
    ...(dialogScopes ? { scope: dialogScope } : {}),
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
  /** The dialog whose first page failed: its history says so (`dialogError`) and the tail opens from the stream's start. */
  const [historyFailedFor, setHistoryFailedFor] = useState<string | null>(null);
  /** The dialog an older page failed for: paging stops asking until a page answers again (its sentinel would ask on
   *  every scroll to the end). */
  const [olderFailedFor, setOlderFailedFor] = useState<string | null>(null);
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

  // ─── The open dialog's own record ─────────────────────────────────────────
  // A dialog reached by link, notification or reload is not necessarily in the list (archived, or past the pages read):
  // its record gives the panel its title, owner and archived state, and says when the dialog does not resolve.
  const { fetchDialog } = history;
  const [recordEntry, setRecordEntry] = useState<DialogRecordEntry | null>(null);
  const openRecord = recordEntry && recordEntry.dialogId === dialogId ? recordEntry : null;
  useEffect(() => {
    if (!active || !dialogId || !fetchDialog) return undefined;
    let current = true;
    fetchDialog(dialogId)
      .then(record => {
        if (!current) return;
        setRecordEntry({ dialogId, record, error: record ? null : 'This conversation could not be found.' });
        // The dialog's usage until the stream says more.
        if (record?.tokenUsage && !store.snapshotOf(dialogId).state.dialogTokenUsage) {
          store.mutate(dialogId, r => r.setDialogTokenUsage(record.tokenUsage ?? null));
        }
      })
      .catch((err: unknown) => {
        if (!current) return;
        console.error('[useChatEngine] fetchDialog failed:', err);
        setRecordEntry({ dialogId, record: null, error: errorText(err) });
      });
    return () => {
      current = false;
    };
  }, [active, dialogId, fetchDialog, store]);

  // The list's scope follows the open dialog once: someone else's dialog is on no tab but everyone's. Reconciled during
  // render, so the tab that cannot list it never shows for a frame; never back, which would fight a person's own pick.
  const [scopeReconciledFor, setScopeReconciledFor] = useState<string | null>(null);
  const openOwnerId = openRecord?.record?.dialog.owner?.id ?? undefined;
  if (dialogScopes && dialogId && openRecord?.record && scopeReconciledFor !== dialogId) {
    setScopeReconciledFor(dialogId);
    if (openOwnerId && currentUserId && openOwnerId !== currentUserId) setDialogScope('all');
  }

  const dialogError =
    openRecord?.error ?? (dialogId && historyFailedFor === dialogId ? 'This conversation could not be loaded.' : null);

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
        if (cursor === undefined) {
          setHistorySeq({ dialogId: id, seq: null });
          setHistoryFailedFor(id);
        } else {
          setOlderFailedFor(id);
        }
        return;
      }
      if (cursor === undefined) setHistoryFailedFor(prev => (prev === id ? null : prev));
      setOlderFailedFor(prev => (prev === id ? null : prev));
      const { messages: processed } = processHistoricalMessages(page.messages, {
        assistantName,
        ...(assistantAvatar !== undefined ? { assistantAvatar } : {}),
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
    [store, assistantName, assistantAvatar, chatTypeFilter, isBufferingActive, backfills],
  );

  const loadDialogHistory = useCallback(
    (id: string, cursor?: string): Promise<void> =>
      readHistoryPage(id, cursor).then(page => applyHistoryPage(id, cursor, page)),
    [readHistoryPage, applyHistoryPage],
  );

  // Dialogs this chat just created: their thread already holds the send that created them, and they have no history to
  // read, so (re)entering one keeps its thread and its tail starts at the stream's start.
  const createdDialogsRef = useRef(new Set<string>());

  // Reset and reload when the active dialog changes.
  const prevDialogIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevDialogIdRef.current === dialogId) return;
    prevDialogIdRef.current = dialogId;
    // Invalidates an in-flight page of the previous dialog, the clear path too.
    historyLoadSeqRef.current += 1;
    if (dialogId && createdDialogsRef.current.delete(dialogId)) {
      setLoadedFor(dialogId);
      setHistorySeq({ dialogId, seq: 0 });
      return;
    }
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

  // The dialog the tail is subscribed to, and the sends waiting for it (`awaitsSubscription`).
  const subscribedForRef = useRef<string | null>(null);
  const subscriptionWaitersRef = useRef(new Map<string, Array<(subscribed: boolean) => void>>());
  const settleSubscriptionWaiters = useCallback((id: string, subscribed: boolean) => {
    const waiters = subscriptionWaitersRef.current.get(id);
    if (!waiters) return;
    subscriptionWaitersRef.current.delete(id);
    for (const settle of waiters) settle(subscribed);
  }, []);
  useEffect(() => {
    subscribedForRef.current = null;
    // A send waiting on a dialog that is no longer open will not be subscribed for.
    for (const id of [...subscriptionWaitersRef.current.keys()])
      if (id !== dialogId) settleSubscriptionWaiters(id, false);
  }, [dialogId, settleSubscriptionWaiters]);
  useEffect(
    () => () => {
      for (const id of [...subscriptionWaitersRef.current.keys()]) settleSubscriptionWaiters(id, false);
    },
    [settleSubscriptionWaiters],
  );
  /** Resolves true once the tail is subscribed to the dialog, false when it is not within the wait or the dialog left. */
  const awaitSubscription = useCallback(
    (id: string): Promise<boolean> => {
      if (subscribedForRef.current === id) return Promise.resolve(true);
      return new Promise<boolean>(resolve => {
        const timer = setTimeout(() => settleSubscriptionWaiters(id, false), SUBSCRIPTION_WAIT_MS);
        const waiters = subscriptionWaitersRef.current.get(id) ?? [];
        waiters.push(subscribed => {
          clearTimeout(timer);
          resolve(subscribed);
        });
        subscriptionWaitersRef.current.set(id, waiters);
      });
    },
    [settleSubscriptionWaiters],
  );

  transport.useLiveTail({
    enabled: active && dialogId != null,
    dialogId,
    fromSeq,
    onEvent: (raw, messageType) => {
      const payload = portsRef.current.transformChunk ? portsRef.current.transformChunk(raw) : raw;
      // Through the back-fill buffer, so its dedupe sees the live tail too; a replaying tail goes straight in.
      if (backfills) catchupProcessChunk(payload as ChunkData, messageType);
      else processChunk(payload);
      setConnectedForDialog(currentDialogIdRef.current ?? null);
    },
    onConnect: handleConnect,
    onResync: () => {
      if (dialogId) void loadDialogHistory(dialogId);
    },
    onSubscribed: () => {
      if (!dialogId) return;
      subscribedForRef.current = dialogId;
      settleSubscriptionWaiters(dialogId, true);
    },
  });

  // "connecting" until the dialog's tail has produced an event; derived, so a switch reads "connecting" on its own.
  const connectionState: ChatConnectionState =
    !active || !dialogId ? 'connected' : connectedForDialog === dialogId ? 'connected' : 'connecting';

  // ─── Commands ─────────────────────────────────────────────────────────────
  /** Open a dialog the engine owns the selection of. A controlled host is told nothing: its `dialogId` is the dialog. */
  const openDialog = useCallback(
    (id: string | null) => {
      if (!isControlled) setInternalDialogId(id);
    },
    [isControlled],
  );

  /** Create a dialog and open it; the list shows it at once. Null when it could not be created. */
  const createAndOpenDialog = useCallback(
    async (create: ChatNewDialogOptions & { sendOptions?: UnifiedSendMessageOptions }): Promise<string | null> => {
      const { createDialog } = portsRef.current.history;
      if (!createDialog) return null;
      setIsCreatingDialog(true);
      try {
        const { dialogId: newId } = await createDialog({
          ...(create.title ? { title: create.title } : {}),
          ...(create.intent ? { intent: create.intent } : {}),
          ...(create.prompt ? { firstMessage: create.prompt } : {}),
          ...(create.sendOptions ? { sendOptions: create.sendOptions } : {}),
        });
        // The list shows the new conversation at once, under its name; the next refresh replaces it with the real entry.
        upsertDialogTop({ id: newId, title: create.title || NEW_DIALOG_TITLE, timestamp: new Date() });
        createdDialogsRef.current.add(newId);
        openDialog(newId);
        currentDialogIdRef.current = newId;
        if (create.prompt && newDialogGreeting) {
          store.upsertMessage(newId, {
            id: `welcome-${newId}`,
            role: 'assistant',
            metadata: { createdAt: new Date().toISOString(), author: { name: assistantName, assistantType: 'mingo' } },
            parts: [{ type: 'text', text: newDialogGreeting }],
          });
        }
        return newId;
      } catch (err) {
        console.error('[useChatEngine] createDialog failed:', err);
        return null;
      } finally {
        setIsCreatingDialog(false);
      }
    },
    [store, openDialog, upsertDialogTop, newDialogGreeting, assistantName],
  );

  /** Publish into a dialog: once its tail is subscribed when the transport needs that, and a failure left as a row. */
  const publishInto = useCallback(
    async (key: string, targetDialogId: string | null, text: string, sendOptions: UnifiedSendMessageOptions) => {
      const { transport: port, sendFailureText: failureText } = portsRef.current;
      try {
        if (port.awaitsSubscription && targetDialogId && !(await awaitSubscription(targetDialogId))) {
          throw new Error('The chat could not connect. Please try again.');
        }
        const sent = await port.publish(text, { ...sendOptions, dialogId: targetDialogId });
        return sent !== false;
      } catch (err) {
        const failure = failureText(err);
        store.mutate(key, r => {
          r.setPhase('idle');
          if (failure) r.failTurn(failure);
        });
        console.error('[useChatEngine] send failed:', err);
        return false;
      }
    },
    [store, awaitSubscription],
  );

  const sendMessage = useCallback(
    async (text: string, sendOptions?: UnifiedSendMessageOptions): Promise<boolean> => {
      const hidden = sendOptions?.hidden ?? false;
      const send = { ...sendOptions, hidden };
      // A send with no dialog open creates one first, when the backend can: the message goes into it.
      if (!dialogId && !isControlled && portsRef.current.history.createDialog) {
        const newId = await createAndOpenDialog({ prompt: text, sendOptions: send });
        if (!newId) return false;
        store.pushOptimisticSend(newId, text, { hidden });
        return publishInto(newId, newId, text, send);
      }
      if (sendSupersedesPending) {
        // Sending over a pending approval interrupts it (the backend answers it rejected a moment later), and over a
        // pending escalation offer supersedes it: each card resolves as the bubble appears.
        const { messages: thread } = store.snapshotOf(dialogKey);
        const pendingId = findLatestPendingId(thread, pendingApprovalIdOf);
        const pendingOfferId = findLatestPendingId(thread, pendingOfferIdOf);
        store.mutate(dialogKey, r => {
          if (pendingId) r.projectApprovalResolution(pendingId, 'rejected');
          if (pendingOfferId) r.projectApprovalResolution(pendingOfferId, 'cancelled');
        });
      }
      // The bubble, its placeholder, the echo it expects and the phase: all the reducer's.
      store.pushOptimisticSend(dialogKey, text, { hidden });
      return publishInto(dialogKey, dialogId, text, send);
    },
    [store, dialogKey, dialogId, isControlled, createAndOpenDialog, publishInto, sendSupersedesPending],
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

  const selectDialog = openDialog;

  /**
   * A new dialog: created and opened, named when the app names it (renamed once it exists, so the list never shows it as
   * a new chat), and sent its first message when a launcher gives one. With no options and nothing to create one with,
   * it is the draft: no dialog open, the next send creates it.
   */
  const startNewDialog = useCallback(
    async (start: ChatNewDialogOptions = {}): Promise<string | null> => {
      if (isCreatingDialog) return null;
      const { history: backend } = portsRef.current;
      if (!backend.createDialog) return null;
      const { prompt } = start;
      if (!prompt && !start.title && !start.intent) {
        openDialog(null);
        return null;
      }
      const newId = await createAndOpenDialog(start);
      if (!newId) return null;
      if (start.title && backend.renameDialog) {
        try {
          await backend.renameDialog(newId, start.title);
        } catch (err) {
          console.error('[useChatEngine] naming the new dialog failed:', err);
        }
      }
      if (prompt) {
        store.pushOptimisticSend(newId, prompt);
        await publishInto(newId, newId, prompt, { hidden: false });
      }
      return newId;
    },
    [isCreatingDialog, openDialog, createAndOpenDialog, publishInto, store],
  );

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
        ? { approveEscalation: (offerId: string) => handleOfferRef.current(offerId, true) }
        : {}),
      ...(canRejectEscalation ? { rejectEscalation: (offerId: string) => handleOfferRef.current(offerId, false) } : {}),
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

  const { streamingPhase, writingMessageId, dialogTokenUsage = null, liveModel = null } = state;
  // The thread as drawn: a row with no author of its own gets the chat's voice.
  // `authors` is read by value, so a host that builds it inline does not redraw the thread each render.
  const hasAuthors = authors !== undefined;
  const authorName = authors?.assistant.name;
  const authorAvatar = authors?.assistant.avatar;
  const ownName = authors?.names.own ?? '';
  const otherName = authors?.names.other ?? '';
  const messages = useMemo(
    () =>
      hasAuthors
        ? state.messages.map(message =>
            withThreadAuthor(message, { name: authorName, avatar: authorAvatar }, { own: ownName, other: otherName }),
          )
        : state.messages,
    [state.messages, hasAuthors, authorName, authorAvatar, ownName, otherName],
  );
  // A compaction still running locks the composer as a turn does.
  const isCompacting = isCompactingTail(state.messages);
  const isLoading = streamingPhase !== 'idle' || isCompacting;
  const hasMoreMessages = messagesNextCursor != null && olderFailedFor !== dialogId;
  // The open dialog's record: what the list may not hold.
  const activeDialog: DialogItem | null = openRecord?.record?.dialog ?? null;

  // Always present: this engine's panel owns a dialog list. Each field is gated on its own callback.
  const { compactDialog } = history;
  const dialogCapabilities = useMemo<ChatDialogCapabilities>(
    () => ({
      canRename: isManagedMode && !!history.renameDialog,
      canArchive: isManagedMode && !!history.archiveDialog,
      fetchArchivedDialogs: isManagedMode ? fetchArchivedDialogs : undefined,
      unarchiveDialog: isManagedMode ? unarchiveDialog : undefined,
      ...(isManagedMode ? { searchQuery, onSearchChange: setSearchQuery } : {}),
      ...(isManagedMode && compactDialog
        ? {
            compactDialog: (dialog: DialogItem) => {
              void compactDialog(dialog.id).catch((err: unknown) => {
                console.error('[useChatEngine] compactDialog failed:', err);
              });
            },
          }
        : {}),
    }),
    [
      isManagedMode,
      history.renameDialog,
      history.archiveDialog,
      fetchArchivedDialogs,
      unarchiveDialog,
      searchQuery,
      compactDialog,
    ],
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
      activeDialog,
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
      ...(dialogScopes ? { dialogScope, setDialogScope } : {}),
      hasMoreMessages,
      loadMoreMessages,
      dialogCapabilities,
      dialogTokenUsage,
      connectionState,
      dialogError,
      isCompacting,
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
      activeDialog,
      dialogScopes,
      dialogScope,
      dialogError,
      isCompacting,
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
