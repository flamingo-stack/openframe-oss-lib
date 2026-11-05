'use client';

/**
 * useChatEngine: THE web chat, for every host (the hubs, OpenFrame Mingo, the Fae client), as one `UnifiedChatState`. A
 * host hands it a transport (`ChatTransport`) and a history backend (`ChatHistoryBackend`), and optionally the thread
 * store to keep its threads in.
 *
 *   live tail:  transport.useLiveTail ─→ catch-up buffer ─→ useChatChunkProcessor ─→ ChatThreadStore (the reducers)
 *               transport.publish / stop / approve / reject ←─ the state's commands
 *   stream:     transport.openTurn ─→ UiChunk ─→ ChatThreadStore (`useStreamTurns`), a send and an approval each a turn
 *   history:    history.fetchDialogMessages ─→ processHistoricalMessages ─→ store.hydrate
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
 * What a chat did beside this before, each host on its own, is here too: the list's first page and the open dialog's
 * record read again on a timer (`refresh`), a composer locked by a turn whose end never arrived released by an idle
 * record, a history read again on request (`reloadHistory`), the viewer's own direct message closing the turn it opened,
 * a card's Display (`slashCommands`), the link to copy (`copyDialogLink`) and the faces of history rows (`avatarUrlOf`).
 *
 * `active` gates the network work (the tail, the back-fill, the list), so the unified chat can keep an engine mounted for
 * a mode that is not showing. The thread is kept. The transport's kind is fixed for the life of the engine.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { approvalRequestIdOf, type ChatMessage, type ChatMessageMetadata } from '../../../chat-protocol/chat-message';
import { defaultTableIdForDocumentType } from '../../../utils/source-icons';
import type { ChatRef } from '../chat-ref.types';
import { useChunkCatchup } from '../hooks/use-chunk-catchup';
import { useManagedDialogList } from '../hooks/use-managed-dialog-list';
import { CHAT_HISTORY_PAGE_SIZE } from '../mingo-chat-history';
import type { ChatDialogSide } from '../stream/chat-dialog-store';
import type { ChatApprovalStatus, ChunkData } from '../types';
import type { AssistantType } from '../types/chat.types';
import type { DialogItem, SlashCommandSummary } from '../types/component.types';
import type { ChatMessageActions } from '../types/message.types';
import type {
  ChatConnectionState,
  ChatDialogCapabilities,
  ChatNewDialogOptions,
  UnifiedChatState,
  UnifiedSendMessageOptions,
  UnifiedUsageBreakdown,
} from '../types/unified-chat-state.types';
import { buildDiscussPrompt } from '../utils/discuss-ref-prompt';
import { isCompactingTail } from '../utils/extract-incomplete-message-state';
import { processHistoricalMessages } from '../utils/process-historical-messages';
import { formatSingularLookupInvocation, sanitizeTitleForChat } from '../utils/slash-dispatch-utils';
import {
  findLatestPendingId,
  pendingApprovalIdOf,
  pendingOfferIdOf,
  threadForDisplay,
  withThreadAuthor,
  type ThreadAuthorNames,
} from '../utils/thread-display';
import { chatDialogSideKey, createChatDialogSidesStore } from './chat-dialog-sides';
import { createChatThreadStore, type ChatThreadStore } from './chat-thread-store';
import type {
  ChatDialogRecord,
  ChatHistoryBackend,
  ChatRememberedDialog,
  ChatTransport,
  FetchDialogMessagesResult,
  UseChatLiveTail,
} from './chat-transport';
import {
  useChatChunkProcessor,
  type ChatChunkObservers,
  type ChatDirectMessageRules,
} from './use-chat-chunk-processor';
import { useChatThread } from './use-chat-thread';
import { useStreamTurns } from './use-stream-turns';

export interface UseChatEngineConfig {
  transport: ChatTransport;
  history?: ChatHistoryBackend;
  /** Where the threads live. Default: a store of the engine's own, for the life of the component. */
  store?: ChatThreadStore<string>;
  /**
   * The side of the dialog this engine shows, for a dialog with sides (a ticket's end-user chat beside its technician's).
   * Its threads are kept under (dialog, side) in a store of dialogs with sides (`createChatDialogSidesStore`), where an
   * approval answered or a tool run on one side shows on the others. Fixed for the life of the engine.
   */
  side?: ChatDialogSide;
  /**
   * The dialog is in direct mode as far as the host knows (a person took it over): the thread drops the assistant's
   * chunks from the moment it is set, before a direct message on the wire says so.
   */
  directMode?: boolean;
  /**
   * The model the newest answer in the dialog's history ran on is the badge's, before the host's baseline
   * (`modelProvider`, `modelLabel`): its label, by provider and model id. Without it the badge is the baseline until a
   * turn names its model.
   */
  historyModelLabel?: (provider: string, model: string) => string;
  /**
   * The active dialog in bare-transport mode (no `history.fetchDialogs`): the host's, verbatim, `null` for none. Ignored
   * in managed mode, where the engine owns the selection.
   */
  dialogId?: string | null;
  /** Approval tiers drawn as actionable cards (default `['CLIENT']`): another tier's card waits on someone else. */
  displayApprovalTypes?: readonly string[];
  /** The assistant's name on a history page's rows (default 'Mingo'). */
  assistantName?: string;
  /** Which assistant a history page's rows and a new dialog's greeting are drawn as (default 'mingo'). */
  assistantType?: AssistantType;
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
  /** Where the open dialog is remembered across reloads (the hub keeps it locally). Read once, when the engine mounts. */
  rememberDialog?: ChatRememberedDialog;
  /** "Copy Chat Link" in the header and on every row: the host owns the address and the clipboard. */
  copyDialogLink?: (dialog: DialogItem) => void;
  /** A list that settled empty and unsearched lands on the composer: a public panel's first-time visitor asks at once. */
  emptyListSkipsToCompose?: boolean;
  /** The slash-command catalog: a card's "Display" runs the command of its table that declares the `display` action. */
  slashCommands?: readonly SlashCommandSummary[];
  /** The table of a document type, for Display and, over a stream, Discuss. Default the lib's map. */
  tableIdForDocumentType?: (documentType: string) => string | null;
  /** A row author's face as a full address: history rows carry the stored, relative one. */
  avatarUrlOf?: (stored: string) => string | null | undefined;
  /** The list's first page, the open dialog's record and a locked composer, asked about again on a timer. */
  refresh?: ChatEngineRefresh;
}

/**
 * What the engine asks again, and how often: titles a server generates, row statuses and dialogs started elsewhere
 * arrive with no event, and a turn's end can be lost (a tail that died with it).
 */
export interface ChatEngineRefresh {
  /** The list's first page and the open dialog's record are read again this often. */
  intervalMs: number;
  /** Sooner while a dialog the list or the record shows waits for its generated title (`DialogItem.awaitsTitle`). */
  awaitingTitleMs?: number;
  /**
   * While the composer is locked, the open dialog's record is read this often, and one that says no answer is being
   * written (`streamState: 'IDLE'`), read after the lock and after the last chunk, releases it.
   */
  busyMs?: number;
  /** Whether a read may run now (a session that is signed out or hidden asks nothing). Default always. */
  allowed?: () => boolean;
}

/** A card's answer the engine sends. */
export type ChatEngineAction = 'approve' | 'reject' | 'approveEscalation' | 'rejectEscalation';

export interface UseChatEngineOptions {
  /** When false the engine goes idle (no tail, no back-fill, no list); its thread is kept. Default true. */
  active?: boolean;
}

/** The key of the "no dialog selected" thread. */
const DRAFT_DIALOG_KEY = '__draft__';

/** A stream transport has no tail. */
const NO_TAIL_PORT: { useLiveTail: UseChatLiveTail } = { useLiveTail: () => undefined };

/** A chat with no slash-command catalog has nothing to display a row with. */
const NO_COMMANDS: readonly SlashCommandSummary[] = [];

/** A one-thread chat selects nothing. */
const NO_SELECTION = (_id: string | null): void => undefined;

/** The slash-command action that shows a row's body in the chat verbatim. */
const DISPLAY_ACTION_ID = 'display';

function supportsDisplay(command: SlashCommandSummary): boolean {
  return command.actions.some(action => action.id === DISPLAY_ACTION_ID);
}

/**
 * The chat message that displays `reference`, or null when the catalog has no command for it: the command of the row's
 * own table (`sourceRepo`, when a row knows it), else of its document type's, that declares the `display` action.
 */
export function displayCommandFor(
  reference: ChatRef,
  commands: readonly SlashCommandSummary[],
  tableIdForDocumentType: (documentType: string) => string | null = defaultTableIdForDocumentType,
): string | null {
  const tableIds = [reference.sourceRepo, tableIdForDocumentType(reference.type)];
  const command = tableIds
    .filter((tableId): tableId is string => Boolean(tableId))
    .map(tableId => commands.find(candidate => candidate.primarySourceId === tableId && supportsDisplay(candidate)))
    .find((candidate): candidate is SlashCommandSummary => Boolean(candidate));
  if (!command) return null;
  // The slug is what the backend resolves fastest; the title the fallback and the id the last resort.
  const slug = typeof reference.metadata?.slug === 'string' ? reference.metadata.slug : '';
  const value = slug || sanitizeTitleForChat(reference.title) || reference.id;
  return formatSingularLookupInvocation(`${command.id} ${DISPLAY_ACTION_ID}`, value);
}

/** The newest answer that has reported usage: the live turn's, or until it reports, the one before it. */
function latestUsageOf(messages: readonly ChatMessage[]): NonNullable<ChatMessageMetadata['usage']> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const usage = messages[i].metadata?.usage;
    if (messages[i].role === 'assistant' && usage) return usage;
  }
  return null;
}

function isWireRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The `breakdown` on a turn's usage is an opaque wire blob; these readers hand back what `UnifiedUsageBreakdown` holds. */
function readTokenPair(value: unknown): { input: number; output: number } | undefined {
  if (!isWireRecord(value) || typeof value.input !== 'number') return undefined;
  // A pair that omitted `output` must not put `undefined` into a `number` field and NaN any downstream sum.
  return { input: value.input, output: typeof value.output === 'number' ? value.output : 0 };
}

function readRoutedAnswer(value: unknown): { model: string; complexity: string; thinkingBudget: number } | undefined {
  if (!isWireRecord(value) || typeof value.model !== 'string') return undefined;
  return {
    model: value.model,
    complexity: typeof value.complexity === 'string' ? value.complexity : '',
    thinkingBudget: typeof value.thinkingBudget === 'number' ? value.thinkingBudget : 0,
  };
}

function usageBreakdownOf(raw: unknown): UnifiedUsageBreakdown | null {
  if (!isWireRecord(raw)) return null;
  return {
    haikuRewriter: readTokenPair(raw.haikuRewriter),
    haikuClassifier: readTokenPair(raw.haikuClassifier),
    haikuSummarizer: readTokenPair(raw.haikuSummarizer),
    routedAnswer: readRoutedAnswer(raw.routedAnswer),
  };
}

/** A row's author face as a full address. One object per row, so the message memo holds. */
const avatarResolved = new WeakMap<ChatMessage, { of: unknown; message: ChatMessage }>();
function withAvatarUrl(message: ChatMessage, avatarUrlOf: (stored: string) => string | null | undefined): ChatMessage {
  const cached = avatarResolved.get(message);
  if (cached && cached.of === avatarUrlOf) return cached.message;
  const author = message.metadata?.author;
  const avatar = author?.avatar ? avatarUrlOf(author.avatar) : undefined;
  const resolved =
    !author?.avatar || !avatar || avatar === author.avatar
      ? message
      : { ...message, metadata: { ...message.metadata, author: { ...author, avatar } } };
  avatarResolved.set(message, { of: avatarUrlOf, message: resolved });
  return resolved;
}

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

/** The model the newest answer of a thread ran on, as its history row named it. */
function newestModelOf(messages: readonly ChatMessage[]): { provider: string; model: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const { role, metadata } = messages[i];
    if (role === 'assistant' && metadata?.provider && metadata.model) {
      return { provider: metadata.provider, model: metadata.model };
    }
  }
  return null;
}

export function useChatEngine(config: UseChatEngineConfig, options: UseChatEngineOptions = {}): UnifiedChatState {
  const { active = true } = options;
  const {
    transport,
    history = {},
    dialogId: controlledDialogId,
    displayApprovalTypes = DEFAULT_DISPLAY_APPROVAL_TYPES,
    assistantName = 'Mingo',
    assistantType = 'mingo',
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
    rememberDialog,
    copyDialogLink,
    emptyListSkipsToCompose = false,
    slashCommands = NO_COMMANDS,
    tableIdForDocumentType = defaultTableIdForDocumentType,
    avatarUrlOf,
    refresh,
    side,
    directMode,
    historyModelLabel,
  } = config;
  const { fetchDialogs, fetchDialogMessages, fetchArchivedDialogs } = history;
  // The kind is fixed for the engine's life: a live tail is a hook, called on every render or never.
  const stream = transport.kind === 'stream' ? transport : null;
  const liveTail = transport.kind === 'stream' ? null : transport;

  // The transport and the history as a host passes them, often a new object each render: every command reads them
  // here, so the state's commands keep their identity (the message memo compares `actions` by reference).
  const portsRef = useRef({ transport, history, sendFailureText, onActionError, transformChunk, rememberDialog });
  useEffect(() => {
    portsRef.current = { transport, history, sendFailureText, onActionError, transformChunk, rememberDialog };
  });

  // ─── Active dialog ────────────────────────────────────────────────────────
  // Capability, not value: with `fetchDialogs` the engine owns the selection, and a `dialogId` passed beside it is
  // ignored. Without it a host that passes `dialogId` owns it, `null` included ("none, idle tail"); one that does not
  // leaves it to the engine.
  const isManagedMode = fetchDialogs !== undefined;
  const isControlled = !isManagedMode && controlledDialogId !== undefined;
  const [internalDialogId, setInternalDialogId] = useState<string | null>(() => rememberDialog?.load() ?? null);
  const dialogId = isControlled ? (controlledDialogId ?? null) : internalDialogId;
  // A stream chat with no list is one thread: the dialog its server minted is the engine's own business, never shown.
  const showsDialogs = !stream || isManagedMode;

  // The remembered dialog follows the selection.
  useEffect(() => {
    if (!isControlled) portsRef.current.rememberDialog?.save(internalDialogId);
  }, [isControlled, internalDialogId]);

  // The committed dialog, for async continuations: one whose dialog is no longer active must not touch the new one.
  const currentDialogIdRef = useRef<string | null>(dialogId);
  useEffect(() => {
    currentDialogIdRef.current = dialogId;
  });

  // A dialog a stream's server minted mid-turn: its thread stays under the key the turn writes into (the draft's), until
  // the dialog is left.
  const [mintedAlias, setMintedAlias] = useState<{ dialogId: string; key: string } | null>(null);
  // A minted alias is a key already (the turn's), side included.
  const keyOfDialog = useCallback(
    (id: string | null): string => {
      if (id && mintedAlias?.dialogId === id) return mintedAlias.key;
      const base = id ?? DRAFT_DIALOG_KEY;
      return side === undefined ? base : chatDialogSideKey(base, side);
    },
    [mintedAlias, side],
  );

  // ─── The thread ───────────────────────────────────────────────────────────
  // Approval statuses are id-keyed and GLOBAL across dialogs (a resolved approval must not come back actionable after a
  // switch), so the engine keeps an instance-lifetime map that tops up every (re)entered dialog.
  const [globalApprovalStatuses] = useState<Record<string, ChatApprovalStatus>>(() => ({}));
  const [ownStore] = useState(() =>
    side === undefined
      ? createChatThreadStore<string>({ options: () => ({ approvalStatuses: globalApprovalStatuses }) })
      : createChatDialogSidesStore({ sides: [side], options: () => ({ approvalStatuses: globalApprovalStatuses }) }),
  );
  const store = config.store ?? ownStore;
  // A side is kept under (dialog, side): a store that reads its keys as dialog ids would keep every side as a dialog.
  if (side !== undefined && store.identityOf(chatDialogSideKey(DRAFT_DIALOG_KEY, side)).side !== side) {
    throw new Error('[useChatEngine] a `side` needs a store of dialogs with sides (`createChatDialogSidesStore`).');
  }
  const dialogKey = keyOfDialog(dialogId);
  const dialogKeyRef = useRef(dialogKey);
  useEffect(() => {
    dialogKeyRef.current = dialogKey;
  });
  const keyOfDialogRef = useRef(keyOfDialog);
  useEffect(() => {
    keyOfDialogRef.current = keyOfDialog;
  });
  const { state } = useChatThread(store, dialogKey);

  /** The turn the open thread is in ends here: its message closed, the composer free. */
  const closeTurn = useCallback(
    (key: string) => {
      store.mutate(key, r => {
        r.apply({ chunks: [{ type: 'finish' }] });
        r.setPhase('idle');
      });
    },
    [store],
  );

  // The viewer's own direct message came back and no answer follows it: the turn the send opened is closed, so what
  // comes next is not written into its placeholder, and the lock it took is lowered.
  const chunkObservers = useMemo<ChatChunkObservers>(
    () => ({
      ...observers,
      onOwnDirectEcho: seq => {
        closeTurn(dialogKeyRef.current);
        observers?.onOwnDirectEcho?.(seq);
      },
    }),
    [observers, closeTurn],
  );

  useEffect(() => {
    Object.assign(globalApprovalStatuses, state.approvalStatuses);
  }, [globalApprovalStatuses, state.approvalStatuses]);

  // The direct-mode barrier the host knows of, on the open thread's reducer.
  useEffect(() => {
    if (directMode !== undefined) store.mutate(dialogKey, r => r.setDirectMode(directMode));
  }, [store, dialogKey, directMode]);

  const processChunk = useChatChunkProcessor({
    thread: store.bind(dialogKey),
    observers: chunkObservers,
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
      const port = portsRef.current.transport;
      const approve = port.kind === 'stream' ? undefined : port.approve;
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
      const port = portsRef.current.transport;
      const reject = port.kind === 'stream' ? undefined : port.reject;
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
      const port = portsRef.current.transport;
      if (port.kind === 'stream') return;
      const answer = approve ? port.approveEscalation : port.rejectEscalation;
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

  // ─── The open dialog's own record ─────────────────────────────────────────
  // A dialog reached by link, notification or reload is not necessarily in the list (archived, or past the pages read):
  // its record gives the panel its title, owner and archived state, and says when the dialog does not resolve.
  const [recordEntry, setRecordEntry] = useState<DialogRecordEntry | null>(null);
  /** What a command just changed on a dialog, laid on its record (a rename, a restore) so the panel says it at once. */
  const patchRecord = useCallback((id: string, patch: Partial<DialogItem>) => {
    setRecordEntry(prev =>
      prev && prev.dialogId === id && prev.record
        ? { ...prev, record: { ...prev.record, dialog: { ...prev.record.dialog, ...patch } } }
        : prev,
    );
  }, []);

  // ─── Dialog list (managed mode) ───────────────────────────────────────────
  const [isCreatingDialog, setIsCreatingDialog] = useState<boolean>(false);
  // The list's server-side search and owner scope: a change of either reloads its first page.
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogScope, setDialogScope] = useState<'my' | 'all'>('my');
  // The backend's commands, each laying what it changed on the open dialog's record once it succeeded.
  const backendRename = history.renameDialog;
  const renameOnBackend = useMemo(
    () =>
      backendRename &&
      (async (id: string, title: string) => {
        await backendRename(id, title);
        patchRecord(id, { title });
      }),
    [backendRename, patchRecord],
  );
  const backendArchive = history.archiveDialog;
  const archiveOnBackend = useMemo(
    () =>
      backendArchive &&
      (async (id: string) => {
        await backendArchive(id);
        patchRecord(id, { archived: true });
      }),
    [backendArchive, patchRecord],
  );
  // Leaving a dialog is the engine's, through the selection: a stream's open request goes with it.
  const leaveDialogRef = useRef<(id: string) => void>(() => undefined);
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
    bumpDialogToTop,
    patchDialog,
    applyFreshFirstPage,
  } = useManagedDialogList({
    autoLoad: active,
    fetchDialogs,
    renameDialog: renameOnBackend,
    archiveDialog: archiveOnBackend,
    deleteDialog: history.deleteDialog,
    pageSize: dialogsPageSize,
    search: searchQuery || undefined,
    ...(dialogScopes ? { scope: dialogScope } : {}),
    logTag: '[useChatEngine]',
    onDialogRemoved: (id, reason) => {
      if (reason === 'deleted') store.drop(keyOfDialogRef.current(id));
      if (isManagedMode) leaveDialogRef.current(id);
    },
  });
  const backendUnarchive = history.unarchiveDialog;
  // A restored dialog is back in the list, and its record no longer says archived.
  const unarchiveDialog = useMemo(
    () =>
      backendUnarchive &&
      (async (id: string) => {
        await backendUnarchive(id);
        patchRecord(id, { archived: false });
        reloadDialogs();
      }),
    [backendUnarchive, patchRecord, reloadDialogs],
  );

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

  const { fetchDialog } = history;
  const openRecord = recordEntry && recordEntry.dialogId === dialogId ? recordEntry : null;
  /** How many times the open record was asked for again (the refresh timer): each one reads it once more. */
  const [recordReads, setRecordReads] = useState(0);
  useEffect(() => {
    if (!active || !dialogId || !fetchDialog) return undefined;
    let current = true;
    const key = keyOfDialogRef.current(dialogId);
    fetchDialog(dialogId)
      .then(record => {
        if (!current) return;
        setRecordEntry({ dialogId, record, error: record ? null : 'This conversation could not be found.' });
        // A title the list does not have yet (generated since the list was read).
        if (record) patchDialog(dialogId, { title: record.dialog.title });
        // The dialog's usage until the stream says more.
        if (record?.tokenUsage && !store.snapshotOf(key).state.dialogTokenUsage) {
          store.mutate(key, r => r.setDialogTokenUsage(record.tokenUsage ?? null));
        }
      })
      .catch((err: unknown) => {
        if (!current) return;
        console.error('[useChatEngine] fetchDialog failed:', err);
        // A read again that failed keeps what the first one said.
        setRecordEntry(prev =>
          prev && prev.dialogId === dialogId && prev.record ? prev : { dialogId, record: null, error: errorText(err) },
        );
      });
    return () => {
      current = false;
    };
  }, [active, dialogId, fetchDialog, store, patchDialog, recordReads]);

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
  const backfills = liveTail !== null && !liveTail.replays;
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
    fetchChunks: liveTail?.fetchChunks,
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

  // A dialog the backend says the caller cannot read, opened with nothing sent into it: it is left (`leaveDialogRef`).
  const isStream = stream !== null;
  const applyHistoryPage = useCallback(
    (id: string, cursor: string | undefined, page: FetchDialogMessagesResult | 'failed' | null): void => {
      if (page === null) return;
      const key = keyOfDialogRef.current(id);
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
      if (cursor === undefined && page.missing) {
        // Deleted, or no longer the caller's (claimed by an account this browser is signed out of): kept open, every
        // later send would go into a dialog the server refuses to record. Unless the viewer has already written in it.
        if (store.snapshotOf(key).messages.length === 0 && currentDialogIdRef.current === id) {
          leaveDialogRef.current(id);
        }
        return;
      }
      const processed =
        page.thread ??
        processHistoricalMessages(page.messages ?? [], {
          assistantName,
          ...(assistantAvatar !== undefined ? { assistantAvatar } : {}),
          assistantType,
          chatTypeFilter,
          approvalStatuses: store.snapshotOf(key).state.approvalStatuses,
        }).messages;
      if (cursor === undefined) {
        if (isStream && store.snapshotOf(key).messages.length > 0) {
          // A send that went out before the history landed: nothing typed is lost, the history goes before it.
          store.mutate(key, r => r.prependMessages(processed));
        } else {
          // The first page: THE hydration door. Adoption is armed only while a back-fill is still buffering, the replay
          // that would consume it.
          store.hydrate(key, processed, { expectingReplay: backfills && isBufferingActive() });
        }
        setHistorySeq({ dialogId: id, seq: maxStreamSeq(processed) });
      } else {
        store.mutate(key, r => r.prependMessages(processed));
      }
      if (page.tokenUsage !== undefined) store.mutate(key, r => r.setDialogTokenUsage(page.tokenUsage ?? null));
      setCursorEntry({ dialogId: id, cursor: page.nextCursor });
    },
    [store, assistantName, assistantAvatar, assistantType, chatTypeFilter, isBufferingActive, backfills, isStream],
  );

  const loadDialogHistory = useCallback(
    (id: string, cursor?: string): Promise<void> =>
      readHistoryPage(id, cursor).then(page => applyHistoryPage(id, cursor, page)),
    [readHistoryPage, applyHistoryPage],
  );

  // Dialogs this chat just created: their thread already holds the send that created them, and they have no history to
  // read, so (re)entering one keeps its thread and its tail starts at the stream's start.
  const createdDialogsRef = useRef(new Set<string>());

  // Reset when the active dialog changes, and read its history once the engine is active: a dialog restored while the
  // engine was idle (a mode not showing) is read when it becomes active.
  const prevDialogIdRef = useRef<string | null | undefined>(undefined);
  const requestedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevDialogIdRef.current !== dialogId) {
      prevDialogIdRef.current = dialogId;
      requestedForRef.current = null;
      // Invalidates an in-flight page of the previous dialog, the clear path too.
      historyLoadSeqRef.current += 1;
      if (dialogId && createdDialogsRef.current.delete(dialogId)) {
        requestedForRef.current = dialogId;
        setLoadedFor(dialogId);
        setHistorySeq({ dialogId, seq: 0 });
        return;
      }
      // A clean slate for the (re)entered dialog; the statuses survive, topped up with the global map (the reducer's
      // precedence: what the stream learned wins).
      store.restart(dialogKey);
      store.mergeApprovalStatuses(dialogKey, globalApprovalStatuses);
    }
    if (!active || !dialogId || requestedForRef.current === dialogId) return;
    requestedForRef.current = dialogId;
    void loadDialogHistory(dialogId);
  }, [active, dialogId, dialogKey, store, globalApprovalStatuses, loadDialogHistory]);

  /** The open dialog's history read again (a reopened ticket): its first page through the hydration door. */
  const reloadHistory = useCallback(() => {
    const id = currentDialogIdRef.current;
    if (id) void loadDialogHistory(id);
  }, [loadDialogHistory]);

  // The initial back-fill of a fresh dialog, beside the history: it buffers the raw chunks the tail may have missed.
  useEffect(() => {
    if (!active || !dialogId || !backfills) return;
    // A dead tail replays its APPROVAL_RESULT / EXECUTING_TOOL chunks on every open, and its releasing MESSAGE_END
    // never replays: the agent-busy lock is suppressed for the replay window (a counter: windows can overlap).
    const key = keyOfDialogRef.current(dialogId);
    store.mutate(key, r => r.adjustAgentBusySuppression(1));
    resetChunkTracking();
    startInitialBuffering();
    catchUpChunks()
      .catch((err: unknown) => {
        console.error('[useChatEngine] initial catchup failed:', err);
      })
      .finally(() => {
        store.mutate(key, r => {
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
    const reconnectKey = reconnectDialogId ? keyOfDialogRef.current(reconnectDialogId) : null;
    if (reconnectKey) store.mutate(reconnectKey, r => r.adjustAgentBusySuppression(1));
    startInitialBuffering();
    void (async () => {
      try {
        if (reconnectDialogId && fetchDialogMessages) await loadDialogHistory(reconnectDialogId);
        if (reconnectDialogId !== currentDialogIdRef.current) return;
        await resetAndCatchUp();
      } catch (err) {
        console.error('[useChatEngine] reconnect catchup failed:', err);
      } finally {
        if (reconnectKey) {
          store.mutate(reconnectKey, r => {
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

  // When the tail last delivered: a record that says the backend is idle is believed only if nothing came after it was asked.
  const lastEventAtRef = useRef(0);
  const tailPort = liveTail ?? NO_TAIL_PORT;
  tailPort.useLiveTail({
    enabled: active && dialogId != null,
    dialogId,
    fromSeq,
    onEvent: (raw, messageType) => {
      lastEventAtRef.current = Date.now();
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
    !liveTail || !active || !dialogId ? 'connected' : connectedForDialog === dialogId ? 'connected' : 'connecting';

  // ─── A stream's turns ─────────────────────────────────────────────────────
  const streamTurns = useStreamTurns({
    transport: stream,
    store,
    currentKey: () => dialogKeyRef.current,
    currentDialogId: () => currentDialogIdRef.current,
    // The server named the dialog this turn created: it is open, its thread the one the turn is writing, and its
    // history is this turn (a read of it would put the same turn in twice once the server has stored it).
    onMinted: (newId, key, hidden) => {
      createdDialogsRef.current.add(newId);
      setMintedAlias({ dialogId: newId, key });
      setInternalDialogId(newId);
      currentDialogIdRef.current = newId;
      // The list shows it at once; the end-of-turn reload swaps in the server's title (the server owns titles).
      if (isManagedMode && !hidden) upsertDialogTop({ id: newId, title: NEW_DIALOG_TITLE, timestamp: new Date() });
    },
    // The list follows the transcript: a first turn reads the list again (the row is stored by the time the stream
    // ends), a later one moves its row to the top, as the server orders it.
    onSettled: minted => {
      if (!isManagedMode) return;
      if (minted) reloadDialogs();
      else if (currentDialogIdRef.current) bumpDialogToTop(currentDialogIdRef.current);
    },
  });
  const {
    send: sendTurn,
    answer: answerTurn,
    stop: stopTurn,
    abort: abortStream,
    streamOpen,
    writingMessageId: writingMessageOfTurn,
  } = streamTurns;

  // ─── Commands ─────────────────────────────────────────────────────────────
  /** Open a dialog the engine owns the selection of. A controlled host is told nothing: its `dialogId` is the dialog. */
  const openDialog = useCallback(
    (id: string | null) => {
      if (isControlled || id === currentDialogIdRef.current) return;
      // A stream still writing belongs to the thread being left.
      abortStream();
      setMintedAlias(null);
      setInternalDialogId(id);
    },
    [isControlled, abortStream],
  );
  useEffect(() => {
    leaveDialogRef.current = id => {
      if (currentDialogIdRef.current === id) openDialog(null);
    };
  });

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
          store.upsertMessage(keyOfDialogRef.current(newId), {
            id: `welcome-${newId}`,
            role: 'assistant',
            metadata: { createdAt: new Date().toISOString(), author: { name: assistantName, assistantType } },
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
    [store, openDialog, upsertDialogTop, newDialogGreeting, assistantName, assistantType],
  );

  /** Publish into a dialog: once its tail is subscribed when the transport needs that, and a failure left as a row. */
  const publishInto = useCallback(
    async (key: string, targetDialogId: string | null, text: string, sendOptions: UnifiedSendMessageOptions) => {
      const { transport: port, sendFailureText: failureText } = portsRef.current;
      try {
        if (port.kind === 'stream') throw new Error('A stream transport sends its own turns.');
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
      if (isStream) return sendTurn(text, sendOptions);
      const hidden = sendOptions?.hidden ?? false;
      const send = { ...sendOptions, hidden };
      // A send with no dialog open creates one first, when the backend can: the message goes into it.
      if (!dialogId && !isControlled && portsRef.current.history.createDialog) {
        const newId = await createAndOpenDialog({ prompt: text, sendOptions: send });
        if (!newId) return false;
        const newKey = keyOfDialogRef.current(newId);
        store.pushOptimisticSend(newKey, text, { hidden });
        return publishInto(newKey, newId, text, send);
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
    [
      store,
      dialogKey,
      dialogId,
      isControlled,
      createAndOpenDialog,
      publishInto,
      sendSupersedesPending,
      isStream,
      sendTurn,
    ],
  );

  const stopMessage = useCallback(() => {
    if (isStream) {
      stopTurn();
      return;
    }
    store.mutate(dialogKey, r => r.setPhase('idle'));
    const port = portsRef.current.transport;
    const stop = port.kind === 'stream' ? undefined : port.stop;
    if (stop && dialogId) {
      void stop(dialogId).catch((err: unknown) => {
        console.error('[useChatEngine] stop failed:', err);
      });
    }
  }, [store, dialogKey, dialogId, isStream, stopTurn]);

  const clearMessages = useCallback(() => {
    if (isStream) {
      // A new chat: whatever is still streaming belongs to the thread being left, and the next send goes out with no
      // dialog, so the server mints a fresh one.
      abortStream();
      store.flush();
      store.mutate(dialogKey, r => r.reset());
      openDialog(null);
      return;
    }
    store.mutate(dialogKey, r => r.clearThread());
  }, [store, dialogKey, isStream, abortStream, openDialog]);

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
        const newKey = keyOfDialogRef.current(newId);
        store.pushOptimisticSend(newKey, prompt);
        await publishInto(newKey, newId, prompt, { hidden: false });
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
  const canApproveEscalation = liveTail?.approveEscalation !== undefined;
  const canRejectEscalation = liveTail?.rejectEscalation !== undefined;
  // What a message's controls do: a stable object, the message memo compares it by reference. A stream answers no card
  // while its request is open: the card's buttons read the absence (a turn may be loading while paused on its own card,
  // so the gate is the stream's and not the panel's).
  const asks = useMemo<ChatMessageActions>(
    () => ({
      selectAsk: label => void sendMessage(label).catch(logSendFailure),
      pickSuggestion: prompt => void sendMessage(prompt).catch(logSendFailure),
    }),
    [sendMessage, logSendFailure],
  );
  const answers = useMemo<ChatMessageActions>(
    () =>
      isStream
        ? { ...asks, approve: id => answerTurn(id, true), reject: (id, reason) => answerTurn(id, false, reason) }
        : {
            approve: id => handleApproveRef.current(id),
            reject: (id, reason) => handleRejectRef.current(id, reason),
            ...(canApproveEscalation
              ? { approveEscalation: (offerId: string) => handleOfferRef.current(offerId, true) }
              : {}),
            ...(canRejectEscalation
              ? { rejectEscalation: (offerId: string) => handleOfferRef.current(offerId, false) }
              : {}),
            ...asks,
          },
    [asks, isStream, answerTurn, canApproveEscalation, canRejectEscalation],
  );
  const actions = isStream && streamOpen ? asks : answers;

  // "Ask" on a card. Over a stream retrieval narrows to the record (`entityIdFilter`), so the prompt need not name it;
  // an agent on a live tail has no record-filtered retrieval, so the prompt names the record and the agent reads it.
  const discussRef = useCallback(
    (reference: ChatRef) => {
      if (!isStream) {
        void sendMessage(buildDiscussPrompt(reference, { includeReference: true })).catch(logSendFailure);
        return;
      }
      const tableId = tableIdForDocumentType(reference.type);
      const refId = (reference.id ?? '').trim();
      if (!tableId || !refId) {
        console.warn(`[useChatEngine] discussRef: no table or id for type="${reference.type}"; ignoring click`);
        return;
      }
      void sendTurn(buildDiscussPrompt(reference), { commandOverride: { entityIdFilter: { tableId, id: refId } } });
    },
    [sendMessage, logSendFailure, isStream, tableIdForDocumentType, sendTurn],
  );

  // "Display" on a card: the catalog's display command of the row's table. Absent, not stubbed, while the catalog has
  // none: the affordance is gated on its presence.
  const canDisplay = slashCommands.some(supportsDisplay);
  const displayRef = useMemo<UnifiedChatState['displayRef']>(() => {
    if (!canDisplay) return undefined;
    return (reference: ChatRef) => {
      const text = displayCommandFor(reference, slashCommands, tableIdForDocumentType);
      if (!text) {
        console.warn(
          `[useChatEngine] displayRef: no display command for type="${reference.type}" sourceRepo="${reference.sourceRepo}"; ignoring click`,
        );
        return;
      }
      void sendMessage(text).catch(logSendFailure);
    };
  }, [canDisplay, slashCommands, tableIdForDocumentType, sendMessage, logSendFailure]);

  const { streamingPhase, dialogTokenUsage = null, liveModel = null } = state;
  // The model of the newest answer in the history, labelled by the host, when it asks for one.
  const historyModel = useMemo(() => {
    if (!historyModelLabel) return null;
    const newest = newestModelOf(state.messages);
    return newest ? { provider: newest.provider, modelLabel: historyModelLabel(newest.provider, newest.model) } : null;
  }, [historyModelLabel, state.messages]);
  const writingMessageId = isStream ? writingMessageOfTurn(state.writingMessageId ?? null) : state.writingMessageId;
  // The thread as drawn: one copy of each card (a live tail's history and its replay both hold them), a row with no
  // author of its own given the chat's voice, and every face a full address.
  // `authors` is read by value, so a host that builds it inline does not redraw the thread each render.
  const hasAuthors = authors !== undefined;
  const authorName = authors?.assistant.name;
  const authorAvatar = authors?.assistant.avatar;
  const ownName = authors?.names.own ?? '';
  const otherName = authors?.names.other ?? '';
  const messages = useMemo(() => {
    const thread = isStream ? state.messages : threadForDisplay(state.messages);
    if (!hasAuthors && !avatarUrlOf) return thread;
    return thread.map(message => {
      const authored = hasAuthors
        ? withThreadAuthor(message, { name: authorName, avatar: authorAvatar }, { own: ownName, other: otherName })
        : message;
      return avatarUrlOf ? withAvatarUrl(authored, avatarUrlOf) : authored;
    });
  }, [state.messages, isStream, hasAuthors, authorName, authorAvatar, ownName, otherName, avatarUrlOf]);
  // A compaction still running locks the composer as a turn does; a stream's `finish` ends the phase before its reader
  // has stopped, and until it has a send would be refused, so the composer offers none.
  const isCompacting = isCompactingTail(state.messages);
  const isLoading = streamingPhase !== 'idle' || isCompacting || streamOpen;
  const hasMoreMessages = messagesNextCursor != null && olderFailedFor !== dialogId;
  // The open dialog's record: what the list may not hold.
  const activeDialog: DialogItem | null = openRecord?.record?.dialog ?? null;

  // ─── Asked again on a timer ───────────────────────────────────────────────
  const { intervalMs: refreshMs, awaitingTitleMs, busyMs, allowed: refreshAllowed } = refresh ?? {};
  const refreshAllowedRef = useRef(refreshAllowed);
  useEffect(() => {
    refreshAllowedRef.current = refreshAllowed;
  });
  const awaitingTitle = dialogs.some(dialog => dialog.awaitsTitle) || activeDialog?.awaitsTitle === true;
  const listRefreshMs = awaitingTitle && awaitingTitleMs ? awaitingTitleMs : refreshMs;
  const listSearch = searchQuery || undefined;
  useEffect(() => {
    if (!active || !listRefreshMs) return undefined;
    let current = true;
    const timer = setInterval(() => {
      if (refreshAllowedRef.current && !refreshAllowedRef.current()) return;
      if (fetchDialogs) {
        fetchDialogs({
          limit: dialogsPageSize,
          ...(listSearch !== undefined ? { search: listSearch } : {}),
          ...(dialogScopes ? { scope: dialogScope } : {}),
        })
          .then(page => {
            if (current) applyFreshFirstPage(page);
          })
          .catch(() => {
            // The next tick asks again; the list on screen stays as it is.
          });
      }
      setRecordReads(count => count + 1);
    }, listRefreshMs);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [
    active,
    listRefreshMs,
    fetchDialogs,
    dialogsPageSize,
    listSearch,
    dialogScopes,
    dialogScope,
    applyFreshFirstPage,
  ]);

  // A locked composer whose turn's end never arrived (a tail that died with it, an approval that was answered and never
  // went on): an IDLE record, asked for after the lock and after the last chunk, with nothing arriving while it was read,
  // releases it.
  const busy = streamingPhase !== 'idle';
  const busySinceRef = useRef(0);
  useEffect(() => {
    if (busy) busySinceRef.current = Date.now();
  }, [busy, dialogId]);
  useEffect(() => {
    if (!active || !busy || !busyMs || !dialogId || !fetchDialog || isStream) return undefined;
    let current = true;
    const id = dialogId;
    const timer = setInterval(() => {
      if (refreshAllowedRef.current && !refreshAllowedRef.current()) return;
      const askedAt = Date.now();
      if (askedAt - busySinceRef.current < busyMs) return;
      void fetchDialog(id)
        .then(record => {
          if (!current || currentDialogIdRef.current !== id) return;
          const nothingSince = lastEventAtRef.current < askedAt && busySinceRef.current < askedAt;
          if (record?.streamState === 'IDLE' && nothingSince) closeTurn(keyOfDialogRef.current(id));
        })
        .catch(() => {
          // Asked again on the next tick.
        });
    }, busyMs);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [active, busy, busyMs, dialogId, fetchDialog, isStream, closeTurn]);

  // ─── The conversation list's capabilities ─────────────────────────────────
  // A live-tail chat's panel owns a dialog list, one with no affordances without `fetchDialogs`; a stream chat with no
  // list is one thread, and reports none. Each field is gated on its own callback.
  const { compactDialog } = history;
  const dialogCapabilities = useMemo<ChatDialogCapabilities | undefined>(() => {
    if (!isManagedMode) {
      return isStream
        ? undefined
        : { canRename: false, canArchive: false, fetchArchivedDialogs: undefined, unarchiveDialog: undefined };
    }
    return {
      canRename: !!history.renameDialog,
      canArchive: !!history.archiveDialog,
      fetchArchivedDialogs,
      unarchiveDialog,
      searchQuery,
      onSearchChange: setSearchQuery,
      ...(copyDialogLink ? { onCopyLink: copyDialogLink } : {}),
      ...(emptyListSkipsToCompose ? { emptyListSkipsToCompose } : {}),
      ...(compactDialog
        ? {
            compactDialog: (dialog: DialogItem) => {
              void compactDialog(dialog.id).catch((err: unknown) => {
                console.error('[useChatEngine] compactDialog failed:', err);
              });
            },
          }
        : {}),
    };
  }, [
    isManagedMode,
    isStream,
    history.renameDialog,
    history.archiveDialog,
    fetchArchivedDialogs,
    unarchiveDialog,
    searchQuery,
    copyDialogLink,
    emptyListSkipsToCompose,
    compactDialog,
  ]);

  // ─── What a turn says about its model and its tokens ──────────────────────
  // Over a stream each answer reports its own usage; over a live tail the dialog's running usage does.
  const turnUsage = useMemo(() => (isStream ? latestUsageOf(state.messages) : null), [isStream, state.messages]);
  const usageBreakdown = useMemo(() => usageBreakdownOf(turnUsage?.breakdown), [turnUsage]);

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
      displayRef,
      reloadHistory,
      // The model: a live `message-metadata` chunk, else the newest answer's in the history (`historyModelLabel`), else
      // the host's baseline.
      currentProvider: liveModel?.provider ?? historyModel?.provider ?? modelProvider ?? null,
      currentModelLabel: liveModel?.modelLabel ?? historyModel?.modelLabel ?? modelLabel ?? null,
      currentContextWindowMaxTokens: dialogTokenUsage?.contextSize ?? liveModel?.contextWindowMaxTokens ?? null,
      currentInputTokens: turnUsage ? (turnUsage.inputTokens ?? null) : (dialogTokenUsage?.inputTokensSize ?? null),
      currentOutputTokens: turnUsage ? (turnUsage.outputTokens ?? null) : (dialogTokenUsage?.outputTokensSize ?? null),
      currentContextTokens: turnUsage?.contextTokens ?? null,
      currentCacheHitRatePct: turnUsage?.hit_rate_pct ?? null,
      currentUsageBreakdown: usageBreakdown,
      dialogs,
      activeDialogId: showsDialogs ? dialogId : null,
      activeDialog,
      selectDialog: showsDialogs ? selectDialog : NO_SELECTION,
      startNewDialog,
      deleteDialog,
      renameDialog,
      archiveDialog,
      isDialogsLoading: isDialogsLoading || isCreatingDialog,
      dialogsError,
      reloadDialogs,
      isMessagesLoading: showsDialogs && isMessagesLoading,
      ...(isStream ? { isHydratingHistory: isMessagesLoading } : {}),
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
      displayRef,
      reloadHistory,
      dialogs,
      dialogId,
      showsDialogs,
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
      isStream,
      hasMoreDialogs,
      loadMoreDialogs,
      hasMoreMessages,
      loadMoreMessages,
      dialogCapabilities,
      dialogTokenUsage,
      liveModel,
      historyModel,
      modelProvider,
      modelLabel,
      turnUsage,
      usageBreakdown,
      connectionState,
    ],
  );
}
