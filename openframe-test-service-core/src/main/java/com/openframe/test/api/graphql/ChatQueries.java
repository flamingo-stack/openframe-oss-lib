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
                                ... on ApprovalRequestData { approvalRequestId command }
                                ... on ErrorData { error details }
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

    public static final String ARCHIVE_DIALOG = """
            mutation ArchiveDialog($input: DialogIdInput!) {
                archiveDialog(input: $input) {
                    dialog { id status }
                    userErrors { message }
                }
            }
            """;
}
