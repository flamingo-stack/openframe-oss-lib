package com.openframe.test.api.graphql;

/**
 * Tenant-scoped remote-access policy on {@code api/graphql} (schema: remote-access-policy.graphqls).
 *
 * <p>{@code RemoteAccessMode} is one of APPROVAL_REQUIRED, NOTIFY_ONLY, SILENT_ACCESS, DENY_ACCESS. The
 * backend resolves device → organization → tenant → code default, and that code default is
 * APPROVAL_REQUIRED ({@code RemoteAccessApprovalProperties}), which is why an unconfigured tenant makes
 * every remote session wait for an end user who is not there.
 */
public final class RemoteAccessQueries {

    private RemoteAccessQueries() {
    }

    public static final String TENANT_REMOTE_ACCESS_POLICY = """
            query RemoteAccessPolicy {
                remoteAccessPolicy {
                    mode
                    usingDefault
                }
            }
            """;

    public static final String SET_TENANT_REMOTE_ACCESS_MODE = """
            mutation SetTenantRemoteAccessMode($mode: RemoteAccessMode!) {
                setTenantRemoteAccessMode(mode: $mode) {
                    policy { mode usingDefault }
                    userErrors { field message }
                }
            }
            """;

    // Remote-access requests and sessions, technician side (openframe-saas-api remote-access.graphqls).
    private static final String REQUEST_FIELDS = """
            fragment remoteAccessRequestFields on RemoteAccessRequest {
                requestId deviceId technicianId sessionKind status mode decisionSource reason ticketId
                recordingEnabled createdAt deliveredAt expiresAt resolvedAt
            }
            """;

    private static final String SESSION_FIELDS = """
            fragment remoteSessionFields on RemoteSession {
                sessionId requestId deviceId technicianId sessionKind mode status startedAt endedAt endReason
                reason ticketId recordingEnabled dialogId durationMs recordingState
                technician { id name }
            }
            """;

    private static final String REQUEST_PAYLOAD_FIELDS = """
            fragment remoteAccessRequestPayloadFields on RemoteAccessRequestPayload {
                request { ...remoteAccessRequestFields }
                created
                userErrors { code message field }
            }
            """ + REQUEST_FIELDS;

    public static final String CREATE_REMOTE_ACCESS_REQUEST = """
            mutation CreateRemoteAccessRequest($input: CreateRemoteAccessRequestInput!) {
                createRemoteAccessRequest(input: $input) { ...remoteAccessRequestPayloadFields }
            }
            """ + REQUEST_PAYLOAD_FIELDS;

    public static final String REMOTE_ACCESS_REQUEST = """
            query RemoteAccessRequest($requestId: String!) {
                remoteAccessRequest(requestId: $requestId) { ...remoteAccessRequestFields }
            }
            """ + REQUEST_FIELDS;

    public static final String REVOKE_REMOTE_ACCESS_REQUEST = """
            mutation RevokeRemoteAccessRequest($requestId: String!) {
                revokeRemoteAccessRequest(requestId: $requestId) { ...remoteAccessRequestPayloadFields }
            }
            """ + REQUEST_PAYLOAD_FIELDS;

    public static final String REMOTE_SESSION = """
            query RemoteSession($sessionId: String!) {
                remoteSession(sessionId: $sessionId) { ...remoteSessionFields }
            }
            """ + SESSION_FIELDS;

    public static final String ACTIVE_REMOTE_SESSION = """
            query ActiveRemoteSession($deviceId: String!) {
                activeRemoteSession(deviceId: $deviceId) { ...remoteSessionFields }
            }
            """ + SESSION_FIELDS;

    public static final String END_REMOTE_SESSION = """
            mutation EndRemoteSession($sessionId: String!) {
                endRemoteSession(sessionId: $sessionId) {
                    session { ...remoteSessionFields }
                    userErrors { code message field }
                }
            }
            """ + SESSION_FIELDS;

    public static final String REMOTE_SESSIONS = """
            query RemoteSessions($deviceId: String!, $from: Instant, $first: Int) {
                remoteSessions(deviceId: $deviceId, from: $from, first: $first) {
                    edges { cursor node { ...remoteSessionFields } }
                    pageInfo { hasNextPage endCursor }
                    totalCount
                }
            }
            """ + SESSION_FIELDS;

    public static final String REMOTE_ACCESS_REQUESTS = """
            query RemoteAccessRequests($deviceId: String!, $from: Instant, $first: Int) {
                remoteAccessRequests(deviceId: $deviceId, from: $from, first: $first) {
                    edges {
                        cursor
                        node {
                            requestId deviceId sessionKind status mode policyScope decisionSource appliedFallback
                            reason createdAt resolvedAt expiresAt
                            technician { id name }
                            session { sessionId requestId status endReason }
                        }
                    }
                    pageInfo { hasNextPage endCursor }
                    totalCount
                }
            }
            """;
}
