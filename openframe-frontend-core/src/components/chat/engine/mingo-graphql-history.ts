/**
 * An OpenFrame dialog's history, read with the lib's one GraphQL document (`chat-protocol/mingo-graphql`). The host hands
 * in how it posts to its `/chat/graphql` (its client, its auth); everything else is here.
 */

import {
  MINGO_MESSAGES_QUERY,
  mingoMessagesPage,
  mingoMessagesVariables,
  type MingoChatType,
  type MingoMessagesConnection,
} from '../../../chat-protocol/mingo-graphql';
import type { FetchDialogMessagesParams, FetchDialogMessagesResult } from '../hooks/use-nats-chat-adapter';

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
