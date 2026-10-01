package com.openframe.test.tests;

import com.openframe.test.api.AgentAuthApi;
import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.RemoteAccessApi;
import com.openframe.test.api.RemoteAccessMachineApi;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.remoteaccess.RemoteAccessRequest;
import com.openframe.test.data.dto.remoteaccess.RemoteAccessRequestAudit;
import com.openframe.test.data.dto.remoteaccess.RemoteAccessRequestConnection;
import com.openframe.test.data.dto.remoteaccess.RemoteAccessRequestPayload;
import com.openframe.test.data.dto.remoteaccess.RemoteAccessStatusResponse;
import com.openframe.test.data.dto.remoteaccess.RemoteSession;
import com.openframe.test.data.dto.remoteaccess.RemoteSessionConnection;
import com.openframe.test.data.dto.remoteaccess.RemoteSessionEdge;
import com.openframe.test.data.dto.remoteaccess.RemoteSessionPayload;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.helpers.FleetWait;
import com.openframe.test.helpers.ai.AgentIdentity;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import io.restassured.response.Response;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Remote-access request and session lifecycle (CP-25) on vm115982: one request of this class's own, the session it opens, and the device's answer over the machine endpoint; no mode is ever changed.
@Tag("saas")
@Tag("needs-device")
@Tag("remote-access")
@DisplayName("Remote access sessions")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class RemoteAccessSessionTest extends BaseTest {

    private static final String WINDOWS = "WINDOWS";
    // The enrolled Windows box on qa; the tenant also holds PENDING_DELETION copies of it, so the ONLINE one is preferred.
    private static final String HOSTNAME = "vm115982";
    private static final RunId RUN_ID = RunId.next();
    private static final String REASON = "E2E remote access " + RUN_ID;
    // requestId and sessionId are plain ULIDs: 26 Crockford base32 characters.
    private static final String ULID = "[0-9A-HJKMNP-TV-Z]{26}";
    private static final String APPROVAL_REQUIRED = "APPROVAL_REQUIRED";
    private static final String SILENT_ACCESS = "SILENT_ACCESS";
    private static final String DENY_ACCESS = "DENY_ACCESS";
    private static final String APPROVED = "APPROVED";
    private static final List<String> LIVE = List.of("PENDING", "DELIVERED");
    private static final List<String> BUSY = List.of("DEVICE_HAS_LIVE_REQUEST", "DEVICE_HAS_ACTIVE_SESSION");
    // Other runs share the box and this account; wait this long for a session of theirs to end before skipping.
    private static final int FREE_WAIT_SECONDS = 180;

    private static Machine device;
    private static RemoteAccessRequest created;
    private static String requestId;
    private static String sessionId;
    private static boolean sessionEnded;
    private static String revokedRequestId;

    @BeforeAll
    public static void pickDevice() {
        device = DeviceApi.getDevices(DeviceGenerator.osDevicesFilter(WINDOWS)).stream()
                .filter(d -> HOSTNAME.equals(d.getHostname()))
                .min(Comparator.comparing((Machine d) -> d.getStatus() != DeviceStatus.ONLINE))
                .orElse(null);
    }

    @Tag("feature")
    @Test
    @DisplayName("Create a remote-access request on a device")
    @Order(1)
    public void testCreateRequest() {
        requireDevice();
        RemoteSession held = FleetWait.until("no session of this account on " + HOSTNAME,
                () -> RemoteAccessApi.getActiveSession(device.getMachineId()), Objects::isNull, FREE_WAIT_SECONDS);
        assumeTrue(held == null, "This account still holds session " + sessionIdOf(held) + " on " + HOSTNAME + ", opened by another run");

        RemoteAccessRequestPayload payload = RemoteAccessApi.createRequest(device.getMachineId(), REASON);
        assumeFalse(payload.codes().stream().anyMatch(BUSY::contains), HOSTNAME + " is held by another technician: " + payload.codes());
        assertThat(payload.codes()).as("Creating a request on an idle device raises no userError").isEmpty();
        assumeTrue(Boolean.TRUE.equals(payload.getCreated()),
                "createRemoteAccessRequest returned live request " + payload.getRequest().getRequestId() + " of this account, which this run did not create");
        created = payload.getRequest();
        requestId = created.getRequestId();
        String mode = created.getMode();

        assertThat(requestId).as("requestId is a plain 26-char ULID, not a Relay id").matches(ULID);
        assertThat(created.getDeviceId()).as("deviceId is the OpenFrame machine id").isEqualTo(device.getMachineId());
        assertThat(created.getTechnicianId()).as("The request records the calling technician").isNotBlank();
        assertThat(created.getSessionKind()).as("The session kind is stored").isEqualTo(RemoteAccessApi.DESKTOP);
        assertThat(created.getReason()).as("The reason is stored").isEqualTo(REASON);
        assertThat(created.getTicketId()).as("No ticket was linked").isNull();
        assertThat(created.getRecordingEnabled()).as("recordingEnabled is always set").isNotNull();
        assertThat(created.getExpiresAt()).as("expiresAt is the server-side deadline after createdAt").isAfter(created.getCreatedAt());
        assertThat(mode).as("The resolved mode is recorded").isNotBlank();
        assertThat(created.getStatus()).as("A request created under %s starts as", mode).isEqualTo(statusAtCreation(mode));
        assertThat(created.getDecisionSource()).as("Under %s the request is settled by", mode)
                .isEqualTo(APPROVAL_REQUIRED.equals(mode) ? null : "POLICY");
        assertThat(created.getResolvedAt()).as("Under %s resolvedAt is", mode)
                .isEqualTo(APPROVAL_REQUIRED.equals(mode) ? null : created.getCreatedAt());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read a remote-access request by id")
    @Order(2)
    public void testReadRequest() {
        requireRequest();

        RemoteAccessRequest read = RemoteAccessApi.getRequest(requestId);

        assertThat(read.getRequestId()).as("remoteAccessRequest returns the requested request").isEqualTo(requestId);
        assertThat(read.getDeviceId()).as("The device is kept").isEqualTo(created.getDeviceId());
        assertThat(read.getTechnicianId()).as("The technician is kept").isEqualTo(created.getTechnicianId());
        assertThat(read.getMode()).as("The mode resolved at creation is kept").isEqualTo(created.getMode());
        assertThat(read.getReason()).as("The reason is kept").isEqualTo(REASON);
        assertThat(read.getCreatedAt()).as("createdAt is kept").isEqualTo(millis(created.getCreatedAt()));
        assertThat(read.getExpiresAt()).as("expiresAt is kept").isEqualTo(millis(created.getExpiresAt()));
        assertThat(read.getStatus()).as("The request has not moved past its creation state")
                .isIn(APPROVAL_REQUIRED.equals(created.getMode()) ? LIVE : List.of(created.getStatus()));
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("A second request on the same device returns the caller's own request with created=false")
    @Order(3)
    public void testCreateAgainReturnsOwnRequest() {
        requireRequest();
        String status = RemoteAccessApi.getRequest(requestId).getStatus();
        assumeTrue(occupiesDevice(status), "Request " + requestId + " no longer holds the device (" + status + "), so a second create would open a new one");

        RemoteAccessRequestPayload again = RemoteAccessApi.createRequest(device.getMachineId(), REASON);

        assertThat(again.codes()).as("The caller's own request is no refusal").isEmpty();
        assertThat(again.getCreated()).as("No new request is created").isFalse();
        assertThat(again.getRequest().getRequestId()).as("The caller's live request is returned").isEqualTo(requestId);
        assertThat(again.getRequest().getStatus()).as("Its status is unchanged").isEqualTo(status);
    }

    @Tag("feature")
    @Test
    @DisplayName("The device approves a pending request over the machine endpoint")
    @Order(4)
    public void testDeviceApprovesPendingRequest() {
        requireRequest();
        assumeTrue(APPROVAL_REQUIRED.equals(created.getMode()),
                HOSTNAME + " resolves to " + created.getMode() + ", which settles a request at creation; nothing is left for the device to approve");
        String token = agentToken();

        Response ack = RemoteAccessMachineApi.ack(token, device.getMachineId(), requestId);
        assertThat(ack.statusCode()).as("The device acknowledges the request").isEqualTo(200);
        Response approved = RemoteAccessMachineApi.approve(token, device.getMachineId(), requestId, true);

        assertThat(approved.statusCode()).as("approve on a live request answers 200").isEqualTo(200);
        RemoteAccessStatusResponse answer = approved.as(RemoteAccessStatusResponse.class);
        assertThat(answer.getRequestId()).as("The answer names the request").isEqualTo(requestId);
        assertThat(answer.getStatus()).as("The request is approved").isEqualTo(APPROVED);
        RemoteAccessRequest read = RemoteAccessApi.getRequest(requestId);
        assertThat(read.getStatus()).as("The technician reads APPROVED").isEqualTo(APPROVED);
        assertThat(read.getDecisionSource()).as("The end user decided").isEqualTo("USER");
        assertThat(read.getResolvedAt()).as("resolvedAt is set on approval").isNotNull();
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("The device's approve on a request the policy settled answers 409 with the settled status")
    @Order(5)
    public void testDeviceApproveOnPolicySettledRequest() {
        requireRequest();
        assumeFalse(APPROVAL_REQUIRED.equals(created.getMode()),
                HOSTNAME + " resolves to APPROVAL_REQUIRED, so the request was left for the device to approve");
        String token = agentToken();

        Response answer = RemoteAccessMachineApi.approve(token, device.getMachineId(), requestId, true);

        assertThat(answer.statusCode()).as("approve on a settled request answers 409").isEqualTo(409);
        RemoteAccessStatusResponse settled = answer.as(RemoteAccessStatusResponse.class);
        assertThat(settled.getRequestId()).as("The 409 names the request").isEqualTo(requestId);
        assertThat(settled.getStatus()).as("The 409 carries the status the policy settled it in").isEqualTo(created.getStatus());
        RemoteAccessRequest read = RemoteAccessApi.getRequest(requestId);
        assertThat(read.getStatus()).as("The device's answer changes nothing").isEqualTo(created.getStatus());
        assertThat(read.getDecisionSource()).as("The policy stays the decider").isEqualTo("POLICY");
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Revoking a settled request answers REMOTE_ACCESS_REQUEST_SETTLED with the settled request")
    @Order(6)
    public void testRevokeSettledRequest() {
        requireRequest();
        String status = RemoteAccessApi.getRequest(requestId).getStatus();
        assumeFalse(LIVE.contains(status), "Request " + requestId + " is still " + status + "; see \"The device approves a pending request over the machine endpoint\"");

        RemoteAccessRequestPayload revoked = RemoteAccessApi.revokeRequest(requestId);

        assertThat(revoked.codes()).as("Revoke on a settled request is refused").containsExactly("REMOTE_ACCESS_REQUEST_SETTLED");
        assertThat(revoked.getCreated()).as("A refusal creates nothing").isFalse();
        assertThat(revoked.getRequest()).as("The settled request is attached").isNotNull();
        assertThat(revoked.getRequest().getRequestId()).as("The attached request is ours").isEqualTo(requestId);
        assertThat(revoked.getRequest().getStatus()).as("The attached request shows its settled status").isEqualTo(status);
        assertThat(RemoteAccessApi.getRequest(requestId).getStatus()).as("The refused revoke changes nothing").isEqualTo(status);
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("An approved request opens the caller's active session on the device")
    @Order(7)
    public void testActiveSession() {
        requireRequest();
        String status = RemoteAccessApi.getRequest(requestId).getStatus();
        assumeTrue(APPROVED.equals(status), "Request " + requestId + " is " + status + ", so it opened no session");

        RemoteSession active = RemoteAccessApi.getActiveSession(device.getMachineId());

        assertThat(active).as("activeRemoteSession returns the caller's session").isNotNull();
        sessionId = active.getSessionId();
        assertThat(sessionId).as("sessionId is a plain 26-char ULID").matches(ULID);
        assertThat(active.getRequestId()).as("The session belongs to our request").isEqualTo(requestId);
        assertActiveSession(active);
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read a remote session by id")
    @Order(8)
    public void testReadSession() {
        requireSession();

        RemoteSession read = RemoteAccessApi.getSession(sessionId);

        assertThat(read.getSessionId()).as("remoteSession returns the requested session").isEqualTo(sessionId);
        assertThat(read.getRequestId()).as("The session names its request").isEqualTo(requestId);
        assertActiveSession(read);
    }

    @Tag("feature")
    @Test
    @DisplayName("End a remote session")
    @Order(9)
    public void testEndSession() {
        requireSession();

        RemoteSessionPayload payload = RemoteAccessApi.endSession(sessionId);

        assertThat(payload.codes()).as("Ending the caller's own session raises no userError").isEmpty();
        RemoteSession ended = payload.getSession();
        sessionEnded = true;
        assertThat(ended.getSessionId()).as("The ended session is returned").isEqualTo(sessionId);
        assertThat(ended.getStatus()).as("The session is ENDED").isEqualTo("ENDED");
        assertThat(ended.getEndReason()).as("A technician's end is recorded as ADMIN").isEqualTo("ADMIN");
        assertThat(ended.getEndedAt()).as("endedAt is not before startedAt").isAfterOrEqualTo(ended.getStartedAt());
        assertThat(ended.getDurationMs()).as("durationMs is set once the session ends").isNotNull().isNotNegative();
        assertThat(RemoteAccessApi.getSession(sessionId).getStatus()).as("remoteSession reads ENDED").isEqualTo("ENDED");
        assertThat(RemoteAccessApi.getActiveSession(device.getMachineId())).as("The device is free again").isNull();
        assertThat(RemoteAccessApi.getRequest(requestId).getStatus()).as("Ending the session expires its request").isEqualTo("EXPIRED");
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Ending an ended session answers REMOTE_SESSION_ENDED with the ended session")
    @Order(10)
    public void testEndEndedSession() {
        requireEndedSession();

        RemoteSessionPayload again = RemoteAccessApi.endSession(sessionId);

        assertThat(again.codes()).as("A second end is refused").containsExactly("REMOTE_SESSION_ENDED");
        assertThat(again.getSession()).as("The ended session is attached").isNotNull();
        assertThat(again.getSession().getSessionId()).as("The attached session is ours").isEqualTo(sessionId);
        assertThat(again.getSession().getStatus()).as("It stays ENDED").isEqualTo("ENDED");
        assertThat(again.getSession().getEndReason()).as("Its end reason is unchanged").isEqualTo("ADMIN");
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("The ended session is in the device's session history")
    @Order(11)
    public void testSessionHistory() {
        requireEndedSession();

        RemoteSessionConnection history = RemoteAccessApi.getSessions(device.getMachineId(), millis(created.getCreatedAt()), 100);

        Optional<RemoteSession> row = history.nodes().stream().filter(s -> sessionId.equals(s.getSessionId())).findFirst();
        assertThat(row).as("remoteSessions lists our session").isPresent();
        assertThat(row.get().getRequestId()).as("The row names its request").isEqualTo(requestId);
        assertThat(row.get().getStatus()).as("The row is ENDED").isEqualTo("ENDED");
        assertThat(row.get().getEndReason()).as("The row keeps the end reason").isEqualTo("ADMIN");
        assertThat(row.get().getTechnician().getId()).as("The row names the technician").isEqualTo(created.getTechnicianId());
        assertThat(history.getEdges()).extracting(RemoteSessionEdge::getCursor).as("Every edge carries a cursor").allMatch(c -> c != null && !c.isBlank());
        assertThat(history.nodes()).extracting(RemoteSession::getStartedAt).as("History is newest first")
                .isSortedAccordingTo(Comparator.<Instant>reverseOrder());
        assertThat(history.getTotalCount()).as("totalCount counts at least the rows returned").isGreaterThanOrEqualTo(history.getEdges().size());
        assertThat(RemoteAccessApi.getSessions(device.getMachineId(), null, 0).getEdges()).as("first is clamped up to 1").hasSize(1);
        assertThat(RemoteAccessApi.getSessions(device.getMachineId(), null, 500).getEdges()).as("first is clamped down to 100").hasSizeLessThanOrEqualTo(100);
        assertThat(RemoteAccessApi.getSessions(device.getMachineId(), null, null).getEdges()).as("first defaults to 20").hasSizeLessThanOrEqualTo(20);
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("The request is in the device's connect-attempt audit")
    @Order(12)
    public void testRequestAudit() {
        requireRequest();
        RemoteAccessRequest current = RemoteAccessApi.getRequest(requestId);

        RemoteAccessRequestConnection audit = RemoteAccessApi.getRequests(device.getMachineId(), millis(created.getCreatedAt()), 100);

        Optional<RemoteAccessRequestAudit> row = audit.nodes().stream().filter(r -> requestId.equals(r.getRequestId())).findFirst();
        assertThat(row).as("remoteAccessRequests lists our request").isPresent();
        assertThat(row.get().getDeviceId()).as("The row names the device").isEqualTo(device.getMachineId());
        assertThat(row.get().getStatus()).as("The row shows the current status").isEqualTo(current.getStatus());
        assertThat(row.get().getMode()).as("The row keeps the resolved mode").isEqualTo(created.getMode());
        assertThat(row.get().getPolicyScope()).as("The row records which scope the mode came from").isNotBlank();
        assertThat(row.get().getDecisionSource()).as("The row records who settled it").isEqualTo(current.getDecisionSource());
        assertThat(row.get().getReason()).as("The row keeps the reason").isEqualTo(REASON);
        assertThat(row.get().getTechnician().getId()).as("The row names the technician").isEqualTo(created.getTechnicianId());
        assertThat(sessionIdOf(row.get().getSession())).as("The row links the session the request opened").isEqualTo(sessionId);
        assertThat(audit.nodes()).extracting(RemoteAccessRequestAudit::getCreatedAt).as("The audit is newest first")
                .isSortedAccordingTo(Comparator.<Instant>reverseOrder());
        assertThat(audit.getTotalCount()).as("totalCount counts at least the rows returned").isGreaterThanOrEqualTo(audit.getEdges().size());
        assertThat(RemoteAccessApi.getRequests(device.getMachineId(), null, 0).getEdges()).as("first is clamped up to 1").hasSize(1);
        assertThat(RemoteAccessApi.getRequests(device.getMachineId(), null, 500).getEdges()).as("first is clamped down to 100").hasSizeLessThanOrEqualTo(100);
    }

    @Tag("feature")
    @Test
    @DisplayName("Revoke a pending request")
    @Order(13)
    public void testRevokePendingRequest() {
        requireRequest();
        assumeTrue(APPROVAL_REQUIRED.equals(created.getMode()),
                HOSTNAME + " resolves to " + created.getMode() + ", which settles every request at creation; none is ever live to revoke");

        RemoteAccessRequestPayload payload = RemoteAccessApi.createRequest(device.getMachineId(), REASON);
        assertThat(payload.codes()).as("A new request on the freed device raises no userError").isEmpty();
        assertThat(payload.getCreated()).as("A new request is created").isTrue();
        revokedRequestId = payload.getRequest().getRequestId();
        RemoteAccessRequestPayload revoked = RemoteAccessApi.revokeRequest(revokedRequestId);

        assertThat(revoked.codes()).as("Revoking the caller's live request raises no userError").isEmpty();
        assertThat(revoked.getRequest().getStatus()).as("The request is REVOKED").isEqualTo("REVOKED");
        assertThat(revoked.getRequest().getDecisionSource()).as("The technician settled it").isEqualTo("TECHNICIAN");
        assertThat(revoked.getRequest().getResolvedAt()).as("resolvedAt is set on revoke").isNotNull();
        assertThat(RemoteAccessApi.getRequest(revokedRequestId).getStatus()).as("remoteAccessRequest reads REVOKED").isEqualTo("REVOKED");
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("A request for an unknown device or a Relay global id answers DEVICE_NOT_FOUND")
    @Order(14)
    public void testCreateRequestForUnknownDevice() {
        requireDevice();

        RemoteAccessRequestPayload unknown = RemoteAccessApi.createRequest("e2e-no-such-device-" + RUN_ID, REASON);
        RemoteAccessRequestPayload globalId = RemoteAccessApi.createRequest(device.getId(), REASON);

        assertThat(unknown.codes()).as("An unknown machine id is refused").containsExactly("DEVICE_NOT_FOUND");
        assertThat(unknown.getRequest()).as("Nothing is created for an unknown device").isNull();
        assertThat(unknown.getCreated()).as("created is false on a refusal").isFalse();
        assertThat(globalId.codes()).as("deviceId takes the machine id, so a Machine global id is not found").containsExactly("DEVICE_NOT_FOUND");
        assertThat(globalId.getRequest()).as("Nothing is created for a global id").isNull();
    }

    // Undoes what a failed run left: a live request is revoked and a session our request opened is ended; settled ones are no-ops.
    @AfterAll
    public static void cleanup() {
        if (revokedRequestId != null) {
            RemoteAccessApi.attemptRevokeRequest(revokedRequestId);
        }
        if (requestId != null) {
            RemoteAccessApi.attemptRevokeRequest(requestId);
            RemoteAccessApi.attemptEndSessionOfRequest(device.getMachineId(), requestId);
        }
    }

    private static void assertActiveSession(RemoteSession session) {
        assertThat(session.getDeviceId()).as("The session is on the device").isEqualTo(device.getMachineId());
        assertThat(session.getTechnicianId()).as("The session belongs to the requesting technician").isEqualTo(created.getTechnicianId());
        assertThat(session.getTechnician().getId()).as("The embedded technician matches").isEqualTo(created.getTechnicianId());
        assertThat(session.getSessionKind()).as("The session kind is copied from the request").isEqualTo(created.getSessionKind());
        assertThat(session.getMode()).as("The mode is copied from the request").isEqualTo(created.getMode());
        assertThat(session.getReason()).as("The reason is copied from the request").isEqualTo(REASON);
        assertThat(session.getRecordingEnabled()).as("recordingEnabled is copied from the request").isEqualTo(created.getRecordingEnabled());
        assertThat(session.getStatus()).as("The session is ACTIVE").isEqualTo("ACTIVE");
        assertThat(session.getStartedAt()).as("startedAt is set").isNotNull();
        assertThat(session.getEndedAt()).as("endedAt is null while ACTIVE").isNull();
        assertThat(session.getEndReason()).as("endReason is null while ACTIVE").isNull();
        assertThat(session.getDurationMs()).as("durationMs is null while ACTIVE").isNull();
        assertThat(session.getRecordingState()).as("An active session reads PROCESSING when recorded, NONE otherwise")
                .isEqualTo(Boolean.TRUE.equals(session.getRecordingEnabled()) ? "PROCESSING" : "NONE");
        assertThat(SILENT_ACCESS.equals(session.getMode()) && session.getDialogId() != null)
                .as("A SILENT_ACCESS session sends nothing to the device, so it has no session chat").isFalse();
    }

    // The status a request is created in under each mode; APPROVAL_REQUIRED waits for the device.
    private static String statusAtCreation(String mode) {
        if (APPROVAL_REQUIRED.equals(mode)) {
            return "PENDING";
        }
        return DENY_ACCESS.equals(mode) ? "DENIED" : APPROVED;
    }

    // The mutation answers with the server clock's full precision; what is stored and read back is milliseconds.
    private static Instant millis(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MILLIS);
    }

    private static boolean occupiesDevice(String status) {
        return LIVE.contains(status) || APPROVED.equals(status);
    }

    private static String sessionIdOf(RemoteSession session) {
        return session == null ? null : session.getSessionId();
    }

    // The device's own AGENT token, minted from the client credentials its agent wrote to disk, read over SSH.
    private static String agentToken() {
        AgentIdentity identity = AgentIdentity.readFrom(new SshMachineVerifier());
        assumeTrue(device.getMachineId().equals(identity.machineId()),
                "The SSH target is enrolled as " + identity.machineId() + ", not as " + HOSTNAME + " (" + device.getMachineId() + ")");
        return AgentAuthApi.getClientCredentialsToken(identity.machineId(), identity.clientId(), identity.clientSecret());
    }

    private static void requireDevice() {
        assumeTrue(device != null, HOSTNAME + " is not listed in this tenant");
    }

    private static void requireRequest() {
        assumeTrue(requestId != null, "No request was created in \"Create a remote-access request on a device\"; see that case");
    }

    private static void requireSession() {
        assumeTrue(sessionId != null, "No session was read in \"An approved request opens the caller's active session on the device\"; see that case");
    }

    private static void requireEndedSession() {
        assumeTrue(sessionEnded, "The session was not ended in \"End a remote session\"; see that case");
    }
}
