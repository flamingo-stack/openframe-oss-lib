package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GoogleWorkspaceAuditEventDeserializerTest {

    private static final long PROCESSING_TS = 1753868000000L;

    private final ObjectMapper mapper = new ObjectMapper();
    private final GoogleWorkspaceAuditEventDeserializer deserializer = new GoogleWorkspaceAuditEventDeserializer(mapper);

    private static final String AUDIT_EVENT_JSON = """
            {
              "uniqueQualifier": "1234567890", "eventIndex": 0, "activityTime": "2026-07-30T10:00:00Z",
              "eventType": "USER_SETTINGS", "eventName": "CREATE_USER", "actorEmail": "admin@x.com",
              "ipAddress": "203.0.113.5",
              "event": {"parameters": [{"name": "USER_EMAIL", "value": "newuser@x.com"}]},
              "tenantId": "tenant-1", "organizationId": "org-uuid-1", "organizationName": "Acme Org",
              "connectionId": "conn-1", "connectionName": "Main"
            }
            """;

    private CommonDebeziumMessage message(String afterJson) {
        try {
            DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
            payload.setAfter(afterJson == null ? null : mapper.readTree(afterJson));
            payload.setOperation("c");
            payload.setTimestamp(PROCESSING_TS);
            CommonDebeziumMessage message = new CommonDebeziumMessage();
            message.setPayload(payload);
            return message;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private DeserializedDebeziumMessage deserialize(String afterJson) {
        return deserializer.deserialize(message(afterJson), MessageType.GOOGLE_WORKSPACE_AUDIT_EVENT);
    }

    @Test
    void registersForGoogleWorkspaceAuditEventType() {
        assertEquals(MessageType.GOOGLE_WORKSPACE_AUDIT_EVENT, deserializer.getType());
    }

    @Test
    void mapsAuditFieldsToDeserializedMessage() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        // Org-suffixed: the fan-out publishes one copy per linked organization and toolEventId is
        // the storage idempotency key — bare ids would collapse the copies to one surviving org.
        assertEquals("1234567890-0-org-uuid-1", result.getToolEventId());
        assertEquals(Instant.parse("2026-07-30T10:00:00Z").toEpochMilli(), result.getEventTimestamp());
        assertEquals("2026-07-30", result.getIngestDay());
        assertEquals("CREATE_USER", result.getMessage());
        assertEquals("USER_SETTINGS", result.getSourceEventType());
        assertEquals(UnifiedEventType.GWS_USER_MANAGEMENT, result.getUnifiedEventType());
        assertEquals(IntegratedToolType.GOOGLE_WORKSPACE, result.getIntegratedToolType());
    }

    @Test
    void passesThroughTenantAndOrgFields() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        assertEquals("tenant-1", result.getTenantId());
        assertEquals("org-uuid-1", result.getOrganizationId());
        assertEquals("Acme Org", result.getOrganizationName());
    }

    @Test
    void extractsUserIdFromActorEmail() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        assertEquals("admin@x.com", result.getUserId());
    }

    @Test
    void hasNoAgentAndIsVisible() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        assertNull(result.getAgentId());
        assertTrue(result.getIsVisible());
        assertFalse(result.getSkipProcessing());
    }

    @Test
    void detailsContainEventIpAddressAndConnectionFields() throws Exception {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        JsonNode details = mapper.readTree(result.getDetails());
        assertEquals("USER_EMAIL", details.path("event").path("parameters").path(0).path("name").asText());
        assertEquals("203.0.113.5", details.get("ipAddress").asText());
        assertEquals("conn-1", details.get("connectionId").asText());
        assertEquals("Main", details.get("connectionName").asText());
    }

    @Test
    void failureEventNameMapsToAuditFailureRegardlessOfEventType() {
        String failed = AUDIT_EVENT_JSON.replace("\"eventName\": \"CREATE_USER\"", "\"eventName\": \"LOGIN_FAILURE\"");

        DeserializedDebeziumMessage result = deserialize(failed);

        assertEquals(UnifiedEventType.GWS_AUDIT_FAILURE, result.getUnifiedEventType());
    }

    @Test
    void failureMarkerIsCaseInsensitive() {
        String failed = AUDIT_EVENT_JSON.replace("\"eventName\": \"CREATE_USER\"", "\"eventName\": \"login_failure\"");

        DeserializedDebeziumMessage result = deserialize(failed);

        assertEquals(UnifiedEventType.GWS_AUDIT_FAILURE, result.getUnifiedEventType());
    }

    @Test
    void unmappedEventTypeFallsBackToAuditOther() {
        String other = AUDIT_EVENT_JSON.replace("\"eventType\": \"USER_SETTINGS\"", "\"eventType\": \"CALENDAR_SETTINGS\"");

        DeserializedDebeziumMessage result = deserialize(other);

        assertEquals(UnifiedEventType.GWS_AUDIT_OTHER, result.getUnifiedEventType());
    }

    @Test
    void missingActivityTimeFallsBackToProcessingTimestamp() {
        String withoutTime = AUDIT_EVENT_JSON.replace("\"activityTime\": \"2026-07-30T10:00:00Z\",", "");

        DeserializedDebeziumMessage result = deserialize(withoutTime);

        assertEquals(PROCESSING_TS, result.getEventTimestamp());
    }

    @Test
    void nullAfterReturnsNull() {
        assertNull(deserialize(null));
    }
}
