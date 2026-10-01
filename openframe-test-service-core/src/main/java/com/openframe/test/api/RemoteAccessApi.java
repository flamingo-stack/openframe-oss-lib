package com.openframe.test.api;

import com.openframe.test.data.dto.remoteaccess.RemoteAccessRequest;
import com.openframe.test.data.dto.remoteaccess.RemoteAccessRequestConnection;
import com.openframe.test.data.dto.remoteaccess.RemoteAccessRequestPayload;
import com.openframe.test.data.dto.remoteaccess.RemoteSession;
import com.openframe.test.data.dto.remoteaccess.RemoteSessionConnection;
import com.openframe.test.data.dto.remoteaccess.RemoteSessionPayload;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static com.openframe.test.api.graphql.RemoteAccessQueries.ACTIVE_REMOTE_SESSION;
import static com.openframe.test.api.graphql.RemoteAccessQueries.CREATE_REMOTE_ACCESS_REQUEST;
import static com.openframe.test.api.graphql.RemoteAccessQueries.END_REMOTE_SESSION;
import static com.openframe.test.api.graphql.RemoteAccessQueries.REMOTE_ACCESS_REQUEST;
import static com.openframe.test.api.graphql.RemoteAccessQueries.REMOTE_ACCESS_REQUESTS;
import static com.openframe.test.api.graphql.RemoteAccessQueries.REMOTE_SESSION;
import static com.openframe.test.api.graphql.RemoteAccessQueries.REMOTE_SESSIONS;
import static com.openframe.test.api.graphql.RemoteAccessQueries.REVOKE_REMOTE_ACCESS_REQUEST;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Remote-access requests and sessions as the signed-in technician; deviceId is the OpenFrame machine id, not a global id.
public class RemoteAccessApi {

    public static final String DESKTOP = "DESKTOP";

    // Creates the request, or returns the caller's own live request on the device with created=false.
    public static RemoteAccessRequestPayload createRequest(String deviceId, String reason) {
        Map<String, Object> input = Map.of("deviceId", deviceId, "sessionKind", DESKTOP, "reason", reason);
        return object(CREATE_REMOTE_ACCESS_REQUEST, "createRemoteAccessRequest", Map.of("input", input), RemoteAccessRequestPayload.class);
    }

    public static RemoteAccessRequest getRequest(String requestId) {
        return object(REMOTE_ACCESS_REQUEST, "remoteAccessRequest", Map.of("requestId", requestId), RemoteAccessRequest.class);
    }

    public static RemoteAccessRequestPayload revokeRequest(String requestId) {
        return object(REVOKE_REMOTE_ACCESS_REQUEST, "revokeRemoteAccessRequest", Map.of("requestId", requestId), RemoteAccessRequestPayload.class);
    }

    // Teardown form: sends the revoke and returns the HTTP status without asserting on it.
    public static int attemptRevokeRequest(String requestId) {
        return send(REVOKE_REMOTE_ACCESS_REQUEST, Map.of("requestId", requestId)).statusCode();
    }

    public static RemoteSession getSession(String sessionId) {
        return object(REMOTE_SESSION, "remoteSession", Map.of("sessionId", sessionId), RemoteSession.class);
    }

    // Null when the caller has no ACTIVE session on the device, including when another technician holds it.
    public static RemoteSession getActiveSession(String deviceId) {
        return object(ACTIVE_REMOTE_SESSION, "activeRemoteSession", Map.of("deviceId", deviceId), RemoteSession.class);
    }

    public static RemoteSessionPayload endSession(String sessionId) {
        return object(END_REMOTE_SESSION, "endRemoteSession", Map.of("sessionId", sessionId), RemoteSessionPayload.class);
    }

    // Teardown form: ends the caller's active session on the device only if it belongs to requestId; 0 when there is none.
    public static int attemptEndSessionOfRequest(String deviceId, String requestId) {
        JsonPath active = send(ACTIVE_REMOTE_SESSION, Map.of("deviceId", deviceId)).jsonPath();
        String sessionId = active.getString("data.activeRemoteSession.sessionId");
        if (sessionId == null || !requestId.equals(active.getString("data.activeRemoteSession.requestId"))) {
            return 0;
        }
        return send(END_REMOTE_SESSION, Map.of("sessionId", sessionId)).statusCode();
    }

    // Session history of a device, newest first; from bounds startedAt inclusively and may be null.
    public static RemoteSessionConnection getSessions(String deviceId, Instant from, Integer first) {
        return object(REMOTE_SESSIONS, "remoteSessions", page(deviceId, from, first), RemoteSessionConnection.class);
    }

    // Connect-attempt audit of a device, newest first; from bounds createdAt inclusively and may be null.
    public static RemoteAccessRequestConnection getRequests(String deviceId, Instant from, Integer first) {
        return object(REMOTE_ACCESS_REQUESTS, "remoteAccessRequests", page(deviceId, from, first), RemoteAccessRequestConnection.class);
    }

    private static Map<String, Object> page(String deviceId, Instant from, Integer first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("deviceId", deviceId);
        if (from != null) {
            variables.put("from", from.toString());
        }
        if (first != null) {
            variables.put("first", first);
        }
        return variables;
    }

    private static <T> T object(String document, String field, Map<String, Object> variables, Class<T> type) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data." + field, type);
    }

    private static Response send(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec()).body(body).post(GRAPHQL);
    }
}
