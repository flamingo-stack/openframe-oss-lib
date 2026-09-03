package com.openframe.test.api;

import com.openframe.test.data.dto.ai.ApproveCommandRequest;
import com.openframe.test.helpers.ai.DialogLockedException;
import io.restassured.http.ContentType;
import io.restassured.response.Response;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

/**
 * Resolves a pending command approval. The same endpoint approves and rejects; {@code approve=false}
 * rejects. The {@code approvalRequestId} comes from an {@code ApprovalRequestData} in the message stream.
 */
public class ApprovalApi {

    private static final String APPROVE = "chat/api/v1/approval-requests/{id}/approve";

    /** The server's code for "this dialog is mid-turn, the approval cannot be applied yet". */
    private static final String DIALOG_LOCKED = "DIALOG_LOCKED";

    /**
     * Resolves the approval, failing with the server's own words when it will not.
     * <p>
     * A bare status assertion is not enough here: the endpoint is a dead end for a whole class of runs —
     * the assistant is mid-execution and simply never proceeds — so the message has to say which request
     * was refused and what the server said, or the case surfaces as an unexplained "expected 200".
     * <p>
     * One refusal is <em>transient</em> and so gets its own type. A {@code 409 DIALOG_LOCKED} means the run
     * still held the dialog lock at the instant we approved, which clears on its own when the turn ends; it
     * is raised as {@link DialogLockedException} so the caller can retry instead of failing a case on a
     * race. Every other non-200 is a real refusal and still raises {@link AssertionError}.
     */
    public static void approve(String approvalRequestId, boolean approve) {
        Response response = given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", approvalRequestId)
                .body(ApproveCommandRequest.builder().approve(approve).build())
                .post(APPROVE);

        if (response.statusCode() == 200) {
            return;
        }

        String body = response.getBody().asString();
        String detail = String.format(
                "%s approval request %s: expected 200 but got %d. Response: %s",
                approve ? "Approving" : "Rejecting", approvalRequestId, response.statusCode(), body);

        // Keyed on the body, not on 409 alone: 409 is the generic conflict status and only its
        // DIALOG_LOCKED variant is the transient one worth another attempt. Read as a substring rather
        // than a parsed field so a non-JSON error page cannot turn a refusal into a parse failure.
        if (response.statusCode() == 409 && body != null && body.contains(DIALOG_LOCKED)) {
            throw new DialogLockedException(detail);
        }

        throw new AssertionError(detail);
    }
}
