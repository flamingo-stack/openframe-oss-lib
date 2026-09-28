package com.openframe.test.api.graphql;

/**
 * GraphQL documents for the AI agent's chat schema, served at {@code chat/graphql}. The {@code MESSAGES}
 * query selects only the union fields the harness needs (via inline fragments); {@code DIALOG} exposes
 * {@code streamState} for diagnostics only.
 */
public class ChatQueries {

    public static final String MESSAGES = """
            query Messages($dialogId: ID!, $chatType: ChatType, $pagination: CursorPaginationInput) {
                messages(dialogId: $dialogId, chatType: $chatType, pagination: $pagination) {
                    edges {
                        cursor
                        node {
                            id
                            createdAt
                            owner { type }
                            messageData {
                                type
                                ... on TextData { text }
                                ... on ExecutedToolData { toolFunction result success }
                                ... on ApprovalRequestData {
                                    approvalRequestId
                                    command
                                    approvalType
                                    toolCalls { toolName toolType toolCallArguments approvalType }
                                }
                                ... on ErrorData { error details }
                                ... on AskData { question options { label description } }
                            }
                        }
                    }
                }
            }
            """;

    public static final String DIALOG_STREAM_STATE = """
            query Dialog($id: ID!) {
                dialog(id: $id) {
                    id
                    streamState
                }
            }
            """;

    /** The ticket a dialog is bound to (a CLIENT dialog gets one auto-created at creation). */
    public static final String DIALOG_TICKET = """
            query DialogTicket($id: ID!) {
                dialog(id: $id) {
                    id
                    ticketId
                }
            }
            """;

    private static final String DIALOG_NODE = "id title status currentMode owner { type } createdAt statusUpdatedAt ticketId";

    public static final String DIALOGS_QUERY = """
            query Dialogs($filter: DialogFilterInput, $pagination: CursorPaginationInput, $search: String) {
                dialogs(filter: $filter, pagination: $pagination, search: $search) {
                    edges { cursor node { %s } }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """.formatted(DIALOG_NODE);

    public static final String DIALOG_STATISTICS = """
            query DialogStatistics {
                dialogStatistics {
                    totalCount
                    statusCounts { status count }
                    averageResolutionTimeFormatted
                    averageRating
                }
            }
            """;

    public static final String RENAME_DIALOG = """
            mutation RenameDialog($input: RenameDialogInput!) {
                renameDialog(input: $input) {
                    dialog { %s }
                    userErrors { message }
                }
            }
            """.formatted(DIALOG_NODE);

    public static final String UNARCHIVE_DIALOG = """
            mutation UnarchiveDialog($input: DialogIdInput!) {
                unarchiveDialog(input: $input) {
                    dialog { %s }
                    userErrors { message }
                }
            }
            """.formatted(DIALOG_NODE);

    public static final String ARCHIVE_DIALOG = """
            mutation ArchiveDialog($input: DialogIdInput!) {
                archiveDialog(input: $input) {
                    dialog { id status }
                    userErrors { message }
                }
            }
            """;
}
