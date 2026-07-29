package com.openframe.test.api;

import com.openframe.test.data.dto.ai.ApproveCommandRequest;
import io.restassured.http.ContentType;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

/**
 * Resolves a pending command approval. The same endpoint approves and rejects; {@code approve=false}
 * rejects. The {@code approvalRequestId} comes from an {@code ApprovalRequestData} in the message stream.
 */
public class ApprovalApi {

    private static final String APPROVE = "chat/api/v1/approval-requests/{id}/approve";

    public static void approve(String approvalRequestId, boolean approve) {
        given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", approvalRequestId)
                .body(ApproveCommandRequest.builder().approve(approve).build())
                .post(APPROVE)
                .then().statusCode(200);
    }
}
