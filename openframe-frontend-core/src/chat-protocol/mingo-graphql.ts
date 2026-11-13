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
            ... on RecordData {
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
              policyReview {
                decision
                approvalLevel
                policyLevel
                operationCodes
                matchedRules {
                  code
                  label
                }
                reason
              }
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
                policyReview {
                  decision
                  approvalLevel
                  policyLevel
                  operationCodes
                  matchedRules {
                    code
                    label
                  }
                  reason
                }
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

// =============================================================================
// Dialogs: the list, the open dialog's record, and what a person does to one
// =============================================================================

/** The owner a dialog row and record name: an admin (with their face), or the machine of an end user's chat. */
const DIALOG_OWNER_SELECTION = `
    owner {
      type
      ... on AdminDialogOwner {
        userId
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
      ... on ClientDialogOwner {
        machineId
        machine {
          id
          machineId
          hostname
        }
      }
    }`;

/**
 * One page of the dialog list. `pendingApproval` rides along when the list draws each row's status (the chat's own
 * list); the other lists (the archive, an incident's chats) need none and do not ask for it.
 */
export function mingoDialogsQuery({ pendingApproval }: { pendingApproval: boolean }): string {
  return `
  query GetDialogs($filter: DialogFilterInput, $first: Int, $after: String, $search: String, $sort: SortInput) {
    dialogs(filter: $filter, first: $first, after: $after, search: $search, sort: $sort) {
      edges {
        cursor
        node {
          id
          dialogId
          title
          status
          streamState${pendingApproval ? '\n          pendingApproval {\n            id\n            approvalType\n          }' : ''}
          createdAt
          statusUpdatedAt
          lastActivityAt${DIALOG_OWNER_SELECTION}
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
}

/** The open dialog's own record: what the list may not hold (an archived dialog, one reached by link). */
export const MINGO_DIALOG_QUERY = `
  query GetDialog($id: ID!) {
    dialog(id: $id) {
      id
      dialogId
      title
      status
      streamState${DIALOG_OWNER_SELECTION}
      createdAt
      statusUpdatedAt
      lastActivityAt
      resolvedAt
      aiResolutionSuggestedAt
      ticketId
      rating {
        id
        dialogId
        createdAt
      }
      tokenUsage {
        chatType
        inputTokensSize
        outputTokensSize
        totalTokensSize
        contextSize
      }
    }
  }
`;

// ─── The chat's commands ─────────────────────────────────────────────────────
// What every OpenFrame chat sends to the ai-agent's `/chat/graphql` (OpenFrame's Mingo and tickets, the Fae client). A
// refused command answers HTTP 200 with `userErrors`, whose `code` is the one the REST endpoints these replace answered.

/** Create a dialog: `dialog.dialogId` is the raw id NATS subjects (`chat.<dialogId>.*`) are keyed by. */
export const MINGO_CREATE_DIALOG_MUTATION = `
  mutation CreateDialog($input: CreateDialogInput!) {
    createDialog(input: $input) {
      dialog { dialogId }
      userErrors { field message code }
    }
  }
`;

/** Send a message into a dialog: the answer arrives on the dialog's live tail. */
export const MINGO_SEND_MESSAGE_MUTATION = `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      userErrors { field message code }
    }
  }
`;

/** Stop the running answer. Without one: `ILLEGAL_STATE`. */
export const MINGO_STOP_DIALOG_GENERATION_MUTATION = `
  mutation StopDialogGeneration($input: StopDialogGenerationInput!) {
    stopDialogGeneration(input: $input) {
      userErrors { field message code }
    }
  }
`;

/** Approve or reject a pending tool approval, by its raw request id. */
export const MINGO_RESOLVE_APPROVAL_REQUEST_MUTATION = `
  mutation ResolveApprovalRequest($input: ResolveApprovalRequestInput!) {
    resolveApprovalRequest(input: $input) {
      userErrors { field message code }
    }
  }
`;

/** Switch a dialog between the AI answering and a person answering (admin tokens only). */
export const MINGO_UPDATE_DIALOG_MODE_MUTATION = `
  mutation UpdateDialogMode($input: UpdateDialogModeInput!) {
    updateDialogMode(input: $input) {
      userErrors { field message code }
    }
  }
`;

/** Who the ai-agent answers for, and the chat a message goes into. */
export type MingoAgentType = 'ADMIN' | 'CLIENT';
export type MingoDialogMode = 'AI' | 'DIRECT';

/** An entity a message carries as context: a device, a ticket, an incident. */
export interface MingoContextItemInput {
  type: string;
  id: string;
}

export interface MingoCreateDialogInput {
  agentType?: MingoAgentType;
  ticketId?: string;
  insightId?: string;
  mode?: MingoDialogMode;
  /** ADMIN dialogs in AI mode only: Mingo opens the dialog with a canned greeting for this intent. */
  intent?: string;
}

export interface MingoSendMessageInput {
  dialogId: string;
  content: string;
  chatType: MingoChatType;
  contextItems?: MingoContextItemInput[];
  currentView?: MingoContextItemInput;
  recentViews?: MingoContextItemInput[];
  /** The list page open when the message was sent, so "these" means the rows matching its filters. */
  currentList?: object;
  /** The page open when the message was sent: its kind and the name the user sees. */
  currentPage?: object;
}

export interface MingoStopDialogGenerationInput {
  id: string;
  chatType: MingoChatType;
}

export interface MingoResolveApprovalRequestInput {
  id: string;
  approve: boolean;
}

export interface MingoUpdateDialogModeInput {
  id: string;
  mode: MingoDialogMode;
}

export const MINGO_RENAME_DIALOG_MUTATION = `
  mutation RenameDialog($input: RenameDialogInput!) {
    renameDialog(input: $input) {
      dialog { id title }
      userErrors { field message }
    }
  }
`;

export const MINGO_ARCHIVE_DIALOG_MUTATION = `
  mutation ArchiveDialog($input: DialogIdInput!) {
    archiveDialog(input: $input) {
      dialog { id status }
      userErrors { field message }
    }
  }
`;

export const MINGO_UNARCHIVE_DIALOG_MUTATION = `
  mutation UnarchiveDialog($input: DialogIdInput!) {
    unarchiveDialog(input: $input) {
      dialog { id status }
      userErrors { field message }
    }
  }
`;

export const MINGO_COMPACT_DIALOG_MUTATION = `
  mutation CompactDialog($input: DialogIdInput!) {
    compactDialog(input: $input) {
      userErrors { field message code }
    }
  }
`;

/** A person's face as the API answers it: the stored image and its cache hash. */
export interface MingoImage {
  imageUrl?: string | null;
  hash?: string | null;
}

/** A dialog row or record as the queries answer it. */
export interface MingoDialogNode {
  /** The Relay global id. */
  id: string;
  /** The raw id: what the NATS subject, the list rows and every chat key on. */
  dialogId: string;
  title?: string | null;
  status?: string | null;
  streamState?: string | null;
  pendingApproval?: { id: string; approvalType?: string | null } | null;
  createdAt: string;
  statusUpdatedAt?: string | null;
  lastActivityAt?: string | null;
  resolvedAt?: string | null;
  aiResolutionSuggestedAt?: string | null;
  ticketId?: string | null;
  owner?: {
    type?: string;
    userId?: string;
    user?: { id?: string; firstName?: string | null; lastName?: string | null; image?: MingoImage | null } | null;
    machineId?: string;
    machine?: { id?: string; machineId?: string; hostname?: string | null } | null;
  } | null;
  rating?: { id: string; dialogId: string; createdAt: string } | null;
  tokenUsage?: Array<{
    chatType?: string | null;
    inputTokensSize?: number | null;
    outputTokensSize?: number | null;
    totalTokensSize?: number | null;
    contextSize?: number | null;
  }> | null;
}

export interface MingoDialogsConnection {
  edges: Array<{ cursor: string; node: MingoDialogNode }>;
  pageInfo: MingoMessagesConnection['pageInfo'];
}

/** A mutation's own refusals. */
export interface MingoUserErrors {
  userErrors?: Array<{ field?: string[] | null; message: string; code?: string | null }> | null;
}

/** A mutation that refused says why: its first user error's message. */
export function throwOnUserErrors(payload: MingoUserErrors | null | undefined): void {
  const first = payload?.userErrors?.[0];
  if (first) throw new Error(first.message);
}
