/**
 * An OpenFrame dialog's history and its dialog list, read with the lib's one GraphQL documents
 * (`chat-protocol/mingo-graphql`). The host hands in how it posts to its `/chat/graphql` (its client, its auth) and which
 * dialogs its list holds; everything else is here.
 */

import {
  MINGO_ARCHIVE_DIALOG_MUTATION,
  MINGO_COMPACT_DIALOG_MUTATION,
  MINGO_DIALOG_QUERY,
  MINGO_MESSAGES_QUERY,
  MINGO_RENAME_DIALOG_MUTATION,
  MINGO_UNARCHIVE_DIALOG_MUTATION,
  mingoDialogsQuery,
  mingoMessagesPage,
  mingoMessagesVariables,
  throwOnUserErrors,
  type MingoChatType,
  type MingoDialogNode,
  type MingoDialogsConnection,
  type MingoImage,
  type MingoMessagesConnection,
  type MingoUserErrors,
} from '../../../chat-protocol/mingo-graphql';
import type { DialogItem } from '../types/component.types';
import type { DialogTokenUsage, FetchDialogsParams, FetchDialogsResult } from '../types/unified-chat-state.types';
import type {
  ChatDialogRecord,
  ChatHistoryBackend,
  FetchDialogMessagesParams,
  FetchDialogMessagesResult,
} from './chat-transport';

/** Post one GraphQL request; resolves to its `data`, and rejects on any GraphQL error. */
export type MingoGraphqlPost = <T>(query: string, variables: Record<string, unknown>) => Promise<T>;

export interface MingoGraphqlHistoryOptions {
  /** Only this chat of the dialog (the client's side of a ticket, the operator's Mingo). */
  chatType?: MingoChatType;
}

export function createMingoGraphqlHistory(
  post: MingoGraphqlPost,
  { chatType }: MingoGraphqlHistoryOptions = {},
): (params: FetchDialogMessagesParams) => Promise<FetchDialogMessagesResult> {
  return async ({ dialogId, cursor, limit = 50 }) => {
    const data = await post<{ messages: MingoMessagesConnection | null }>(
      MINGO_MESSAGES_QUERY,
      mingoMessagesVariables({ dialogId, chatType, cursor, limit }),
    );
    if (!data.messages) return { messages: [], nextCursor: null };
    return mingoMessagesPage(data.messages);
  };
}

/** What an OpenFrame dialog list holds: whose dialogs, in which statuses. */
export interface MingoGraphqlDialogsOptions {
  /** The dialogs of these agents (`['ADMIN']` for Mingo). */
  agentTypes: string[];
  /** The statuses the list shows (the archive is its own list). */
  statuses: readonly string[];
  /** The chat whose usage the record's token readout shows. */
  chatType?: MingoChatType;
  /** Each row's pending approval rides along, for a list that draws row status. */
  pendingApproval?: boolean;
  /** Each row's unread replies (`unreadMessageCount`) ride along, for a list that marks a chat with a new reply. */
  unread?: boolean;
  /** A face's absolute address, from the stored image (the host's image service). */
  imageUrlOf?: (image: MingoImage) => string | null;
}

/** The list's order: the dialog with the latest message first. The cursor follows it. */
const DIALOGS_BY_LAST_ACTIVITY = { field: 'lastActivityAt', direction: 'DESC' } as const;

/** A dialog the list has not named yet: the backend names it once its first message is answered. */
const UNTITLED_DIALOG = 'New Chat';

/** How long after its creation an untitled dialog still waits for the title the backend generates. */
const TITLE_WAIT_MS = 10 * 60_000;

/** Untitled and young: its generated title is on its way. */
function awaitsGeneratedTitle(node: MingoDialogNode): boolean {
  if (node.title) return false;
  const age = Date.now() - new Date(node.createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < TITLE_WAIT_MS;
}

function streamStateOf(node: MingoDialogNode): ChatDialogRecord['streamState'] {
  return node.streamState === 'IDLE' || node.streamState === 'STREAMING' ? node.streamState : null;
}

/** A dialog as the lib's list rows and header read it. */
export function dialogItemOfNode(node: MingoDialogNode, imageUrlOf?: (image: MingoImage) => string | null): DialogItem {
  const user = node.owner?.user;
  const ownerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  return {
    // Raw, not the global id: selection, the active-dialog check and the NATS subject all see raw ids.
    id: node.dialogId,
    archived: node.status === 'ARCHIVED',
    title: node.title || UNTITLED_DIALOG,
    ...(awaitsGeneratedTitle(node) ? { awaitsTitle: true } : {}),
    timestamp: new Date(node.lastActivityAt ?? node.createdAt),
    ...(node.owner?.userId
      ? {
          owner: {
            id: node.owner.userId,
            name: ownerName || null,
            avatarUrl: (user?.image && imageUrlOf?.(user.image)) || null,
          },
        }
      : {}),
  };
}

/** The usage the record's composer readout shows: the chat's own. */
function tokenUsageOf(node: MingoDialogNode, chatType: MingoChatType | undefined): DialogTokenUsage | null {
  const usage = node.tokenUsage?.find(entry => !chatType || entry.chatType === chatType);
  if (!usage) return null;
  return {
    ...(usage.chatType ? { chatType: usage.chatType } : {}),
    inputTokensSize: usage.inputTokensSize ?? 0,
    outputTokensSize: usage.outputTokensSize ?? 0,
    totalTokensSize: usage.totalTokensSize ?? 0,
    contextSize: usage.contextSize ?? 0,
  };
}

/**
 * An OpenFrame dialog list and its dialogs, read and kept with the lib's one GraphQL documents: what the engine's
 * `ChatHistoryBackend` asks of a list. The host hands in how it posts and which dialogs the list holds.
 */
export function createMingoGraphqlDialogs(
  post: MingoGraphqlPost,
  { agentTypes, statuses, chatType, pendingApproval = false, unread = false, imageUrlOf }: MingoGraphqlDialogsOptions,
): Required<
  Pick<
    ChatHistoryBackend,
    | 'fetchDialogs'
    | 'fetchArchivedDialogs'
    | 'fetchDialog'
    | 'renameDialog'
    | 'archiveDialog'
    | 'unarchiveDialog'
    | 'compactDialog'
  >
> {
  const page =
    (query: string, listStatuses: readonly string[]) =>
    async ({ cursor, limit, search, scope }: FetchDialogsParams): Promise<FetchDialogsResult> => {
      const data = await post<{ dialogs: MingoDialogsConnection }>(query, {
        filter: { agentTypes, statuses: listStatuses, ...(scope ? { scope: scope === 'my' ? 'MY' : 'ALL' } : {}) },
        first: limit,
        after: cursor ?? null,
        search: search || null,
        sort: DIALOGS_BY_LAST_ACTIVITY,
      });
      return {
        dialogs: data.dialogs.edges.map(edge => dialogItemOfNode(edge.node, imageUrlOf)),
        nextCursor: data.dialogs.pageInfo.hasNextPage ? data.dialogs.pageInfo.endCursor : null,
      };
    };
  const mutate = async (mutation: string, field: string, input: Record<string, unknown>): Promise<void> => {
    const data = await post<Record<string, MingoUserErrors | null>>(mutation, { input });
    throwOnUserErrors(data[field]);
  };
  return {
    fetchDialogs: page(mingoDialogsQuery({ pendingApproval, unread }), statuses),
    fetchArchivedDialogs: page(mingoDialogsQuery({ pendingApproval: false }), ['ARCHIVED']),
    fetchDialog: async (dialogId: string): Promise<ChatDialogRecord | null> => {
      const data = await post<{ dialog: MingoDialogNode | null }>(MINGO_DIALOG_QUERY, { id: dialogId });
      if (!data.dialog) return null;
      return {
        dialog: dialogItemOfNode(data.dialog, imageUrlOf),
        tokenUsage: tokenUsageOf(data.dialog, chatType),
        streamState: streamStateOf(data.dialog),
      };
    },
    renameDialog: (dialogId: string, title: string) =>
      mutate(MINGO_RENAME_DIALOG_MUTATION, 'renameDialog', { id: dialogId, title }),
    archiveDialog: (dialogId: string) => mutate(MINGO_ARCHIVE_DIALOG_MUTATION, 'archiveDialog', { id: dialogId }),
    unarchiveDialog: (dialogId: string) => mutate(MINGO_UNARCHIVE_DIALOG_MUTATION, 'unarchiveDialog', { id: dialogId }),
    compactDialog: (dialogId: string) => mutate(MINGO_COMPACT_DIALOG_MUTATION, 'compactDialog', { id: dialogId }),
  };
}
