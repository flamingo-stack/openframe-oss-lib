'use client';

/**
 * The hub's chat on the one chat engine (`useChatEngine`): its stream transport, its history and its conversation list,
 * read from the ambient `ChatRuntime`. Nothing else is here; every rule about a turn, an approval and the thread is the
 * engine's (`use-stream-turns`, the reducer).
 *
 *   transport  `sseChatTransport`: a turn is a POST to `chatStreamUrl` whose response is the UI message stream, read by
 *              `readUiChunks`. The wire carries ONLY the newest message (the server re-reads `chat_messages` by
 *              conversation id on every turn); an approval is the standard's round trip on the same endpoint, the card's
 *              message going back holding the answered parts.
 *   history    `hubChatHistory`: the transcript the server keeps (`GET <chatStreamUrl>/history`), and with
 *              `chatConversationsUrl` the conversation list (`createChatConversationsApi`).
 *   memory     the conversation id the SERVER minted and echoed in the stream, and nothing else
 *              (`chat-conversation-storage`): the engine opens it again on mount and reads its history.
 *
 * Two contracts vs hub-side chat hooks:
 *
 *   1. `source` is READ FROM THE RUNTIME, not a parameter. It is OPTIONAL: platform-agnostic embedders leave it unset; an
 *      empty `source` falls back to a stable constant (`DEFAULT_CHAT_SOURCE`) for the localStorage conversation-id
 *      namespace. It is NEVER sent on the wire (the hub resolves source server-side via `currentPlatform()`).
 *
 *   2. `tableIdForDocumentType` is INJECTED via the optional `tableIdForDocumentType` option. Hub callers pass the
 *      registry-backed lookup from `lib/config/rag-table-config`; embedders that don't supply one fall back to
 *      `defaultTableIdForDocumentType` so the `displayRef` / `discussRef` Ask + Display buttons WORK out of the box.
 */

import { useMemo } from 'react';
import { filePartOfAttachment } from '../../../chat-protocol/attachment';
import type { ChatMessage } from '../../../chat-protocol/chat-message';
import { messageOfStoredRow } from '../../../chat-protocol/message-decoder';
import { readServerErrorMessage } from '../../../chat-protocol/server-error';
import { readUiChunks, type UiChunk } from '../../../chat-protocol/ui-chunks';
import { isRecord, unwrapEnvelope } from '../../../chat-protocol/wire-narrow';
import { useRequiredChatRuntime, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch';
import { defaultTableIdForDocumentType } from '../../../utils/source-icons';
import {
  ChatTurnRefused,
  type ChatHistoryBackend,
  type ChatRememberedDialog,
  type ChatStreamTransport,
  type FetchDialogMessagesParams,
  type FetchDialogMessagesResult,
} from '../engine/chat-transport';
import { useChatEngine, type UseChatEngineConfig, type UseChatEngineOptions } from '../engine/use-chat-engine';
import { CHAT_HISTORY_PAGE_SIZE } from '../mingo-chat-history';
import type { FetchDialogsParams, UnifiedChatState } from '../types/unified-chat-state.types';
import { createChatConversationStorage, pruneStaleChatConversationStorage } from '../utils/chat-conversation-storage';
import { createChatConversationsApi } from '../utils/chat-conversations-api';
import { useSlashCommandRegistry } from './use-slash-commands';

/**
 * Options of the hub's chat.
 *
 *   - `tableIdForDocumentType`: the RagTableConfig.id of an LLM document type, which narrows a card's "Discuss" to the
 *     row and finds its "Display" command. Defaults to `defaultTableIdForDocumentType` (`src/utils/source-icons.ts`), a
 *     lib-baked map covering every documentType registered in the hub's RAG_TABLE_CONFIGS.
 */
export interface UseSseChatAdapterOptions {
  tableIdForDocumentType?: (documentType: string) => string | null;
}

/** localStorage namespace used when no `source` is configured on the runtime (embedders are platform-agnostic). */
const DEFAULT_CHAT_SOURCE = 'embed';

/** A client id the server does not know: it means a new conversation (the standard's `id` is always there). */
function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** The conversation id a chunk carries: the server mints it on a session's first turn and says so. */
function conversationIdOfChunk(chunk: UiChunk): string | null {
  if (chunk.type !== 'message-metadata' && chunk.type !== 'start' && chunk.type !== 'finish') return null;
  const id = chunk.messageMetadata?.conversationId;
  return typeof id === 'string' && id !== '' ? id : null;
}

/** The hub's chat endpoint as a stream transport. */
export function sseChatTransport(endpoints: ChatRuntime['endpoints']): ChatStreamTransport {
  return {
    kind: 'stream',
    dialogIdOf: conversationIdOfChunk,
    filePartsOf: attachments =>
      attachments.map(attachment => filePartOfAttachment(attachment, endpoints.attachmentViewUrlPrefix)),
    openTurn: async (turn, signal) => {
      // `source` is NOT in the body: the chat route resolves it server-side, a tamper-proof binding.
      const body =
        turn.kind === 'message'
          ? {
              // A value the server did not issue means a new conversation.
              id: turn.dialogId ?? newClientId('chat'),
              messages: [
                {
                  id: newClientId('user'),
                  role: 'user',
                  parts: [...(turn.text.length > 0 ? [{ type: 'text', text: turn.text }] : []), ...turn.files],
                },
              ],
              ...(turn.commandOverride ? { commandOverride: turn.commandOverride } : {}),
            }
          : {
              id: turn.dialogId,
              trigger: 'submit-message',
              messages: [
                {
                  id: turn.message.id,
                  role: 'assistant',
                  parts: turn.parts.map(part => ({
                    type: 'dynamic-tool',
                    toolName: part.toolName,
                    toolCallId: part.toolCallId,
                    state: 'approval-responded',
                    input: part.input,
                    approval: {
                      id: 'approval' in part ? part.approval?.id : part.toolCallId,
                      approved: turn.approved,
                      ...(turn.reason !== undefined ? { reason: turn.reason } : {}),
                    },
                  })),
                },
              ],
            };
      // `embedAuthedFetch` carries the bearer-act-as headers (+ Supabase session cookies).
      const response = await embedAuthedFetch(endpoints.chatStreamUrl, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      });
      if (!response.ok) {
        // The SERVER's error copy (route-base envelope `{error, code}`): "This approval expired ...", not a status code.
        const serverMessage = await readServerErrorMessage(response);
        const message = serverMessage ?? `Chat request failed: ${response.status}`;
        // A 5xx refuses nothing: it may be a gateway's word about a write still running.
        throw response.status < 500 ? new ChatTurnRefused(message, serverMessage) : new Error(message);
      }
      if (!response.body) throw new Error('No response body');
      return readUiChunks(response.body);
    },
  };
}

/**
 * The hub's conversation history: the transcript the server keeps, one page holding all of it, and with a conversations
 * endpoint the list. A conversation the server reports not readable by this caller (`found: false`: deleted, or claimed
 * by an account this browser is signed out of) is `missing`; an owned but empty one is not.
 */
export function hubChatHistory({
  historyUrl,
  conversationsUrl,
}: {
  historyUrl: string;
  conversationsUrl?: string;
}): ChatHistoryBackend {
  const fetchDialogMessages = async ({ dialogId }: FetchDialogMessagesParams): Promise<FetchDialogMessagesResult> => {
    const response = await embedAuthedFetch(`${historyUrl}?conversationId=${encodeURIComponent(dialogId)}`, {
      method: 'GET',
    });
    if (!response.ok) throw new Error(`History request failed: ${response.status}`);
    // Untrusted wire: narrowed rather than asserted. A row that is not an object is dropped, the good ones kept.
    const body = unwrapEnvelope(await response.json().catch(() => null));
    const rawRows = isRecord(body) ? body.messages : undefined;
    const rows = Array.isArray(rawRows) ? rawRows.filter(isRecord) : [];
    const thread: ChatMessage[] = [];
    for (const row of rows) {
      const message = messageOfStoredRow(row);
      if (message) thread.push(message);
    }
    const missing = rows.length === 0 && isRecord(body) && body.found === false;
    return { thread, nextCursor: null, ...(missing ? { missing } : {}) };
  };
  if (!conversationsUrl) return { fetchDialogMessages };
  const api = createChatConversationsApi(conversationsUrl);
  return {
    fetchDialogMessages,
    fetchDialogs: (params: FetchDialogsParams) => api.fetchDialogs({ ...params, status: 'active' }),
    fetchArchivedDialogs: (params: FetchDialogsParams) => api.fetchDialogs({ ...params, status: 'archived' }),
    renameDialog: api.renameDialog,
    archiveDialog: api.archiveDialog,
    unarchiveDialog: api.unarchiveDialog,
  };
}

/** The conversation id the server minted, remembered for this source (and the signed-in embed identity). */
function rememberedConversation(source: string): ChatRememberedDialog {
  const storage = createChatConversationStorage(source);
  return {
    load: () => storage.load()?.conversationId ?? null,
    save: id => (id ? storage.save({ conversationId: id }) : storage.clear()),
  };
}

/**
 * The engine configuration of the hub's chat, from the ambient runtime. `active` false reads nothing (the slash-command
 * catalog a card's Display runs is read only for a showing chat).
 */
export function useSseEngineConfig(options?: UseSseChatAdapterOptions, active = true): UseChatEngineConfig {
  // Chat-specific code REQUIRES a runtime: the lib's `<HubRuntimeProvider>` (hub) / embedder's provider wraps the tree.
  const runtime = useRequiredChatRuntime();
  const source = runtime.source || DEFAULT_CHAT_SOURCE;
  const { endpoints } = runtime;
  const tableIdForDocumentType = options?.tableIdForDocumentType ?? defaultTableIdForDocumentType;

  // The engine reads its transport when a turn starts, so a new one for new endpoints is taken by the next turn.
  const transport = useMemo(() => sseChatTransport(endpoints), [endpoints]);

  const historyUrl = endpoints.chatHistoryUrl ?? `${endpoints.chatStreamUrl.replace(/\/+$/, '')}/history`;
  const conversationsUrl = endpoints.chatConversationsUrl;
  const history = useMemo(() => hubChatHistory({ historyUrl, conversationsUrl }), [historyUrl, conversationsUrl]);

  // The same react-query entry `EmbeddableChat`'s onboarding list reads, so the catalog is fetched once.
  const { commands: slashCommands } = useSlashCommandRegistry(endpoints.commandsUrl, { enabled: active });

  const rememberDialog = useMemo(() => {
    // Sweeps other-identity keys and retired key shapes of this source.
    pruneStaleChatConversationStorage(source);
    return rememberedConversation(source);
  }, [source]);

  return {
    transport,
    history,
    rememberDialog,
    dialogsPageSize: CHAT_HISTORY_PAGE_SIZE,
    slashCommands,
    tableIdForDocumentType,
    // A public panel's first-time visitor reaches the composer without tapping through an empty list.
    emptyListSkipsToCompose: true,
  };
}

/** The hub's chat: the engine over `useSseEngineConfig`. `active` false keeps it idle (another mode is showing). */
export function useSseChatAdapter(
  options?: UseSseChatAdapterOptions,
  runtimeOptions: UseChatEngineOptions = {},
): UnifiedChatState {
  return useChatEngine(useSseEngineConfig(options, runtimeOptions.active ?? true), runtimeOptions);
}
