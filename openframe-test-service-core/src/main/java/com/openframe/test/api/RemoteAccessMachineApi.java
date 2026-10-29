package com.openframe.test.api;

import io.restassured.response.Response;

import java.util.Map;

import static com.openframe.test.api.AgentAuthApi.MACHINE_ID_HEADER;
import static com.openframe.test.helpers.RequestSpecHelper.getUnAuthorizedSpec;
import static io.restassured.RestAssured.given;

// The machine side of remote access on openframe-saas-client, behind the /clients route, as the device's own agent (bearer token plus x-machine-id); responses are returned unasserted because a settled request answers 409.
public class RemoteAccessMachineApi {

    private static final String ACK = "clients/api/v1/remote-access/requests/{requestId}/ack";
    private static final String APPROVE = "clients/api/v1/remote-access/requests/{requestId}/approve";

    // PENDING -> DELIVERED; any other status is returned unchanged.
    public static Response ack(String agentToken, String machineId, String requestId) {
        return given(getUnAuthorizedSpec())
                .header("Authorization", "Bearer " + agentToken)
                .header(MACHINE_ID_HEADER, machineId)
                .pathParam("requestId", requestId)
                .post(ACK);
    }

    // The end user's answer: approve=true settles a live request APPROVED, false DENIED.
    public static Response approve(String agentToken, String machineId, String requestId, boolean approve) {
        return given(getUnAuthorizedSpec())
                .header("Authorization", "Bearer " + agentToken)
                .header(MACHINE_ID_HEADER, machineId)
                .body(Map.of("approve", approve))
                .pathParam("requestId", requestId)
                .post(APPROVE);
    }
}
