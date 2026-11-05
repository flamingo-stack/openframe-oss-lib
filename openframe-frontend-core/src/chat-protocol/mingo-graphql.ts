/**
 * THE GraphQL document an OpenFrame chat reads a dialog's history with, and the read of its answer: the counterpart of
 * `createMingoDecoder` (which reads what each persisted part says). Every OpenFrame chat (Mingo and tickets in the web
 * app, the Fae client) posts it to its `/chat/graphql`; each keeps only its own HTTP client and auth.
 *
 * It selects `Message.parts`, every field the decoder reads, and nothing for a backend older than that schema: a
 * GraphQL error is an error.
 *
 * Four nullable fields are ALIASED. GraphQL's SameResponseShape rule compares response keys across the whole selection,
 * non-overlapping types included, so `text` (`String!` on `TextData`) cannot share its key with the nullable
 * `EscalationOfferData.text`, `TicketEscalatedData.text` or `AskData.text`, nor `reason` with the enum
 * `TicketEscalatedData.reason`. `historicalMessageOfNode` puts each back under the name the decoder reads.
 */

import type { HistoricalMessage } from '../components/chat/types/message.types';

/** Response key → the field it is selected for, per persisted part type. */
const ALIASED_FIELDS: Record<string, { alias: string; field: string }> = {
  ESCALATION_OFFER: { alias: 'offerText', field: 'text' },
  TICKET_ESCALATED: { alias: 'escalatedText', field: 'text' },
  TICKET_EVENT: { alias: 'ticketEventReason', field: 'reason' },
  ASK: { alias: 'askIntro', field: 'text' },
};

/** One page of a dialog's messages, newest first. */
export const MINGO_MESSAGES_QUERY = `
  query GetDialogMessages($dialogId: ID!, $chatType: ChatType, $cursor: String, $limit: Int, $sortField: String, $sortDirection: SortDirection) {
    messages(
      dialogId: $dialogId
      chatType: $chatType
      first: $limit
      after: $cursor
      sort: { field: $sortField, direction: $sortDirection }
    ) {
      edges {
        cursor
        node {
          id
          dialogId
          chatType
          dialogMode
          createdAt
          lastChunkStreamSeq
          owner {
            type
            ... on AdminOwner {
              user {
                id
                firstName
                lastName
                image {
                  imageUrl
                  hash
                }
              }
            }
            ... on AssistantOwner {
              model
              modelName
              providerName
              contextWindow
            }
          }
          parts {
            type
            ... on TextData {
              text
              contextItems {
                type
                id
              }
            }
            ... on ThinkingData {
              text
            }
            ... on SystemData {
              text
            }
            ... on AskData {
              ${ALIASED_FIELDS.ASK.alias}: text
              question
              options {
                label
                description
              }
            }
            ... on AttachmentsData {
              sources {
                type
                sourceId
                url
                title
                mediaType
                filename
              }
            }
            ... on RecordCardsData {
              records
            }
            ... on ExecutingToolData {
              integratedToolType
              toolFunction
              title
              toolExplanation
              parameters
              requiresApproval
              approvalStatus
              toolExecutionRequestId
            }
            ... on ExecutedToolData {
              integratedToolType
              toolFunction
              result
              success
              requiredApproval
              approvalStatus
              toolExecutionRequestId
            }
            ... on ApprovalRequestData {
              approvalRequestId
              approvalType
              command
              explanation
              toolCalls {
                toolExecutionRequestId
                toolName
                toolTitle
                toolExplanation
                toolType
                requiresApproval
                approvalType
                toolCallArguments
              }
            }
            ... on ApprovalResultData {
              approvalRequestId
              approved
              approvalType
              resolvedByName
            }
            ... on EscalationOfferData {
              offerId
              state
              ${ALIASED_FIELDS.ESCALATION_OFFER.alias}: text
              origin
              resolvedByName
            }
            ... on TicketEscalatedData {
              ticketId
              ticketNumber
              reason
              ${ALIASED_FIELDS.TICKET_ESCALATED.alias}: text
            }
            ... on TicketEventData {
              kind
              actorId
              actorName
              actorType
              targetStatusKind
              ${ALIASED_FIELDS.TICKET_EVENT.alias}: reason
            }
            ... on ContextCompactionEndData {
              summary
            }
            ... on ErrorData {
              error
              details
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

/** The chat a message belongs to: an end user's (the Fae client, a ticket's client side) or the operator's Mingo. */
export type MingoChatType = 'CLIENT_CHAT' | 'ADMIN_AI_CHAT';

export interface MingoMessagesVariables {
  dialogId: string;
  /** Only the messages of one chat of the dialog; omitted, every chat's. */
  chatType?: MingoChatType | null;
  cursor?: string | null;
  limit: number;
}

/** A message node as the query answers it, before its aliases are read back. */
export interface MingoMessageNode extends Omit<HistoricalMessage, 'parts'> {
  dialogMode?: string;
  parts?: Array<Record<string, unknown>>;
}

export interface MingoMessagesConnection {
  edges: Array<{ cursor: string; node: MingoMessageNode }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

/** The variables of one page: newest first, by creation time. */
export function mingoMessagesVariables({ dialogId, chatType, cursor, limit }: MingoMessagesVariables) {
  return {
    dialogId,
    chatType: chatType ?? null,
    cursor: cursor ?? null,
    limit,
    sortField: 'createdAt',
    sortDirection: 'DESC' as const,
  };
}

/** One persisted part with its aliased field back under the name the decoder reads. */
function partOf(part: Record<string, unknown>): Record<string, unknown> {
  const mapping = ALIASED_FIELDS[String(part.type)];
  if (!mapping || !(mapping.alias in part)) return part;
  const { [mapping.alias]: value, ...rest } = part;
  return typeof value === 'string' && value ? { ...rest, [mapping.field]: value } : rest;
}

/** A node as the history reader takes it. */
export function historicalMessageOfNode(node: MingoMessageNode): HistoricalMessage & { dialogMode?: string } {
  return { ...node, parts: (node.parts ?? []).map(partOf) as unknown as HistoricalMessage['parts'] };
}

/** One page, oldest first (the order a thread reads in), and the cursor of the page before it. */
export function mingoMessagesPage(connection: MingoMessagesConnection): {
  messages: Array<HistoricalMessage & { dialogMode?: string }>;
  nextCursor: string | null;
} {
  const messages = connection.edges.map(edge => historicalMessageOfNode(edge.node)).reverse();
  return { messages, nextCursor: connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null };
}
