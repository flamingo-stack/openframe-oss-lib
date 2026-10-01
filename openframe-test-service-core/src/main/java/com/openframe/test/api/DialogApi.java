package com.openframe.test.api;

import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.CreateDialogRequest;
import com.openframe.test.data.dto.ai.DialogConnection;
import com.openframe.test.data.dto.ai.DialogFilterInput;
import com.openframe.test.data.dto.ai.DialogResponse;
import com.openframe.test.data.dto.ai.DialogMode;
import com.openframe.test.data.dto.ai.DialogStatistics;
import com.openframe.test.data.dto.ai.UpdateDialogModeRequest;
import com.openframe.test.data.dto.ai.UpdateDialogStatusRequest;
import com.openframe.test.data.dto.shared.CursorPaginationInput;
import com.openframe.test.data.dto.shared.MutationError;
import com.openframe.test.data.dto.ai.DialogStreamState;
import io.restassured.http.ContentType;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.ChatQueries.ARCHIVE_DIALOG;
import static com.openframe.test.api.graphql.ChatQueries.DIALOGS_QUERY;
import static com.openframe.test.api.graphql.ChatQueries.DIALOG_QUERY;
import static com.openframe.test.api.graphql.ChatQueries.DIALOG_STATISTICS;
import static com.openframe.test.api.graphql.ChatQueries.DIALOG_STREAM_STATE;
import static com.openframe.test.api.graphql.ChatQueries.MARK_DIALOG_MESSAGES_READ;
import static com.openframe.test.api.graphql.ChatQueries.RENAME_DIALOG;
import static com.openframe.test.api.graphql.ChatQueries.UNARCHIVE_DIALOG;
import static com.openframe.test.api.graphql.ChatQueries.DIALOG_TICKET;
import static com.openframe.test.config.EnvironmentConfig.CHAT_GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * Drives the AI agent's dialog endpoints, reached via the gateway {@code /chat} route:
 * REST {@code POST chat/api/v1/dialogs} to create, and GraphQL at {@code chat/graphql} for
 * {@code streamState} (diagnostic) and {@code archiveDialog} (teardown).
 */
public class DialogApi {

    private static final String DIALOGS = "chat/api/v1/dialogs";
    private static final String COMPACT = DIALOGS + "/{id}/compact";
    private static final String STOP = DIALOGS + "/{id}/stop";
    private static final String MODE = DIALOGS + "/{id}/mode";
    private static final String STATUS = DIALOGS + "/{id}/status";

    /** Creates an empty dialog. For ADMIN-with-ticket targeting, {@code request.ticketId} must carry the target device. */
    public static DialogResponse createDialog(CreateDialogRequest request) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .body(request)
                .post(DIALOGS)
                .then().statusCode(201)
                .extract().as(DialogResponse.class);
    }

    /**
     * Asks the agent to compact the dialog's memory and returns the HTTP status unchecked: 202 accepted, 409
     * while a reply is running, 422 when there is nothing new to compact. The summary arrives on the chat
     * stream afterwards; {@code CompactionWaiter} waits for it.
     */
    public static int compact(String dialogId) {
        return given(getAuthorizedSpec())
                .pathParam("id", dialogId)
                .post(COMPACT)
                .statusCode();
    }

    /**
     * Asks the agent to stop the reply in progress and returns the HTTP status unchecked: 200 when a reply
     * was running, 409 when none was. The stop only raises a flag; the run winds down on its own.
     */
    public static int stopGeneration(String dialogId, ChatType chatType) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", dialogId)
                .body(Map.of("chatType", chatType))
                .post(STOP)
                .statusCode();
    }

    // ADMIN only; switching to DIRECT pauses the assistant and hands the client chat to the technician.
    public static DialogResponse updateDialogMode(String dialogId, DialogMode mode) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", dialogId)
                .body(UpdateDialogModeRequest.builder().mode(mode).build())
                .patch(MODE)
                .then().statusCode(200)
                .extract().as(DialogResponse.class);
    }

    // ADMIN only; a RESOLVED or ARCHIVED status closes the client chat.
    public static DialogResponse updateDialogStatus(String dialogId, String status) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", dialogId)
                .body(UpdateDialogStatusRequest.builder().status(status).build())
                .patch(STATUS)
                .then().statusCode(200)
                .extract().as(DialogResponse.class);
    }

    // The dialog as the current actor sees it, unreadMessageCount being that actor's side of the counter.
    public static DialogResponse getDialog(String dialogId) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", DIALOG_QUERY, "variables", Map.of("id", dialogId)))
                .post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.dialog", DialogResponse.class);
    }

    /** Reads {@code streamState} — derived from the Redis dialog lock. Diagnostic only; not a run-completion signal. */
    public static DialogStreamState streamState(String dialogId) {
        Map<String, Object> body = Map.of(
                "query", DIALOG_STREAM_STATE,
                "variables", Map.of("id", dialogId)
        );
        String state = given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data.dialog.streamState");
        return state == null ? null : DialogStreamState.valueOf(state);
    }

    /** The id of the ticket bound to the dialog, or null for a dialog without one. */
    public static String getDialogTicketId(String dialogId) {
        Map<String, Object> body = Map.of(
                "query", DIALOG_TICKET,
                "variables", Map.of("id", dialogId)
        );
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data.dialog.ticketId");
    }

    /** First page of the caller's dialogs; {@code filter} and {@code search} may be null. */
    public static DialogConnection listDialogs(DialogFilterInput filter, int limit, String search) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("pagination", CursorPaginationInput.builder().limit(limit).build());
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (search != null) {
            variables.put("search", search);
        }
        return given(getAuthorizedSpec())
                .body(Map.of("query", DIALOGS_QUERY, "variables", variables))
                .post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.dialogs", DialogConnection.class);
    }

    public static DialogStatistics dialogStatistics() {
        return given(getAuthorizedSpec())
                .body(Map.of("query", DIALOG_STATISTICS, "variables", Map.of()))
                .post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.dialogStatistics", DialogStatistics.class);
    }

    public static DialogResponse renameDialog(String dialogId, String title) {
        return dialogPayload(RENAME_DIALOG, "renameDialog", Map.of("input", Map.of("id", dialogId, "title", title)));
    }

    public static DialogResponse unarchiveDialog(String dialogId) {
        return dialogPayload(UNARCHIVE_DIALOG, "unarchiveDialog", Map.of("input", Map.of("id", dialogId)));
    }

    // Zeroes the caller's side of the unread counter: the client's for an AGENT, the shared technician side for an ADMIN.
    public static DialogResponse markDialogMessagesRead(String dialogId) {
        return dialogPayload(MARK_DIALOG_MESSAGES_READ, "markDialogMessagesRead", Map.of("input", Map.of("id", dialogId)));
    }

    private static DialogResponse dialogPayload(String document, String mutationName, Map<String, Object> variables) {
        var response = given(getAuthorizedSpec())
                .body(Map.of("query", document, "variables", variables))
                .post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
        List<MutationError> userErrors = response.getList("data." + mutationName + ".userErrors", MutationError.class);
        if (userErrors != null && !userErrors.isEmpty()) {
            throw new AssertionError(mutationName + " returned userErrors: " + userErrors);
        }
        return response.getObject("data." + mutationName + ".dialog", DialogResponse.class);
    }

    /** Archives the dialog (teardown). Best-effort — used in cleanup that must run even on failure. */
    public static void archiveDialog(String dialogId) {
        Map<String, Object> body = Map.of(
                "query", ARCHIVE_DIALOG,
                "variables", Map.of("input", Map.of("id", dialogId))
        );
        given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().statusCode(200);
    }
}
