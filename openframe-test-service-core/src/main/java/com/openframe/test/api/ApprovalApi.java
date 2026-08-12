package com.openframe.test.api;

import com.openframe.test.data.dto.ai.ApproveCommandRequest;
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

    /**
     * Resolves the approval, failing with the server's own words when it will not.
     * <p>
     * A bare status assertion is not enough here: the endpoint is a dead end for a whole class of runs —
     * the assistant is mid-execution and simply never proceeds — so the message has to say which request
     * was refused and what the server said, or the case surfaces as an unexplained "expected 200".
     */
    public static void approve(String approvalRequestId, boolean approve) {
        Response response = given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", approvalRequestId)
                .body(ApproveCommandRequest.builder().approve(approve).build())
                .post(APPROVE);

        if (response.statusCode() != 200) {
            throw new AssertionError(String.format(
                    "%s approval request %s: expected 200 but got %d. Response: %s",
                    approve ? "Approving" : "Rejecting", approvalRequestId,
                    response.statusCode(), response.getBody().asString()));
        }
    }
}
