package com.openframe.test.api;

import com.openframe.test.data.dto.ai.CreateDialogRequest;
import com.openframe.test.data.dto.ai.DialogResponse;
import com.openframe.test.data.dto.ai.DialogStreamState;
import io.restassured.http.ContentType;

import java.util.Map;

import static com.openframe.test.api.graphql.ChatQueries.ARCHIVE_DIALOG;
import static com.openframe.test.api.graphql.ChatQueries.DIALOG_STREAM_STATE;
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

    /** Creates an empty dialog. For ADMIN-with-ticket targeting, {@code request.ticketId} must carry the target device. */
    public static DialogResponse createDialog(CreateDialogRequest request) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .body(request)
                .post(DIALOGS)
                .then().statusCode(201)
                .extract().as(DialogResponse.class);
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
